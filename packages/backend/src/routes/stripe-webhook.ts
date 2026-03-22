import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db/client.js";
import {
  subscriptions,
  subscriptionItems,
  plans,
  invoices,
  billingEvents,
} from "../db/schema/billing.js";
import { tenants, tenantModules, auditLog } from "../db/schema/tenants.js";
import { tenantUsers } from "../db/schema/tenant-users.js";
import { constructWebhookEvent, getStripeSubscription } from "../services/stripe.js";
import { dispatchWebhook } from "../services/webhook.js";
import { provisionTenant } from "../services/provisioning.js";
import { determineCouponId } from "../services/billing-utils.js";
import {
  sendWelcomeEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendAccountSuspendedEmail,
  sendPlanChangedEmail,
  sendTrialEndingEmail,
} from "../services/email.js";
import { config } from "../config.js";

/**
 * Extract subscription ID from an invoice's parent field (Stripe v2025-08-27+).
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (
    invoice.parent?.type === "subscription_details" &&
    invoice.parent.subscription_details
  ) {
    const sub = invoice.parent.subscription_details.subscription;
    return typeof sub === "string" ? sub : sub.id;
  }
  return null;
}

/**
 * Resolve tenantId from a Stripe customer ID.
 */
async function resolveTenantId(stripeCustomerId: string): Promise<string | null> {
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return tenant?.id ?? null;
}

/**
 * Check if a Stripe event has already been processed (idempotency).
 */
async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, stripeEventId))
    .limit(1);
  return existing !== undefined;
}

/**
 * Log a billing event for audit and dedup.
 */
async function logBillingEvent(params: {
  tenantId: string | null;
  eventType: string;
  stripeEventId: string;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(billingEvents).values({
    tenantId: params.tenantId,
    eventType: params.eventType,
    stripeEventId: params.stripeEventId,
    amountCents: params.amountCents ?? null,
    currency: params.currency ?? null,
    metadata: params.metadata ?? {},
  });
}

/** Extract customer ID string from Stripe customer field */
function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Parse module metadata from Stripe session.
 */
interface ModuleMeta {
  productId: string;
  moduleId: string;
  tier: string;
  includedUsers: number;
}

function parseModulesMeta(raw: string | undefined): ModuleMeta[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ModuleMeta[];
  } catch {
    return [];
  }
}

/**
 * Handle checkout.session.completed — create tenant (if new signup),
 * activate subscription, trigger provisioning.
 *
 * For new signups: tenant data lives in session.metadata (set by POST /signup/checkout).
 * For reactivations: tenant already exists, just update status.
 */
async function handleCheckoutCompleted(
  event: Stripe.Event,
  sessionData: Stripe.Event.Data.Object,
): Promise<void> {
  const session = sessionData as unknown as Stripe.Checkout.Session;
  if (!session.customer) return;

  const customerId = getCustomerId(session.customer);
  if (!customerId) return;

  const stripeSubId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  // Check if this is a new signup (has companyName in metadata) or a reactivation
  const isNewSignup = Boolean(session.metadata?.companyName);

  let tenantId: string | null;

  if (isNewSignup) {
    // ── New signup — create tenant, modules, user link ──
    const companyName = session.metadata?.companyName ?? "Unknown";
    const companySlug = session.metadata?.companySlug ?? "";
    const billingEmail = session.metadata?.billingEmail ?? "";
    const userId = session.metadata?.userId ?? "";
    const modulesMeta = parseModulesMeta(session.metadata?.modules);

    if (!companySlug || !userId) return;

    // Guard against duplicate tenant creation (idempotency)
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.slug, companySlug), isNull(tenants.deletedAt)))
      .limit(1);

    if (existingTenant) {
      // Tenant already exists — this is a duplicate webhook delivery
      tenantId = existingTenant.id;
      await db
        .update(tenants)
        .set({ status: "active", stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    } else {
      // Create tenant
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: companyName,
          slug: companySlug,
          status: "active",
          billingEmail,
          stripeCustomerId: customerId,
        })
        .returning();

      if (!newTenant) return;
      tenantId = newTenant.id;

      // Insert modules
      for (const mod of modulesMeta) {
        await db.insert(tenantModules).values({
          tenantId,
          productId: mod.productId,
          moduleId: mod.moduleId,
          status: "active",
          maxUsers: mod.includedUsers,
        });
      }

      // Link user as owner
      await db.insert(tenantUsers).values({
        userId,
        tenantId,
        role: "owner",
      });
    }

    // Create subscription record
    if (stripeSubId) {
      const stripeSub = await getStripeSubscription(stripeSubId);

      const modules = await db
        .select({ productId: tenantModules.productId, moduleId: tenantModules.moduleId })
        .from(tenantModules)
        .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.status, "active")));

      const couponId = determineCouponId(modules);

      const [newSub] = await db
        .insert(subscriptions)
        .values({
          tenantId,
          stripeSubscriptionId: stripeSubId,
          status: "active",
          currentPeriodStart: new Date(stripeSub.start_date * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          stripeCouponId: couponId ?? null,
        })
        .returning();

      // Create subscription items
      if (newSub) {
        for (const mod of modules) {
          const [plan] = await db
            .select()
            .from(plans)
            .where(
              and(
                eq(plans.productId, mod.productId),
                eq(plans.moduleId, mod.moduleId),
                eq(plans.isActive, "true"),
              ),
            )
            .limit(1);

          if (plan) {
            const stripeItem = stripeSub.items.data.find(
              (si) => si.price.id === plan.stripePriceId,
            );

            await db.insert(subscriptionItems).values({
              subscriptionId: newSub.id,
              stripeItemId: stripeItem?.id ?? null,
              planId: plan.id,
              moduleId: mod.moduleId,
              productId: mod.productId,
              quantity: 1,
            });
          }
        }
      }
    }

    // Trigger provisioning
    void provisionTenant(tenantId, {
      ownerUserId: userId,
    });

    // Send welcome email
    const [tenant] = await db
      .select({ name: tenants.name, billingEmail: tenants.billingEmail })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (tenant?.billingEmail) {
      void sendWelcomeEmail({
        to: tenant.billingEmail,
        userName: session.metadata?.userName ?? "there",
        companyName: tenant.name,
        loginUrl: config.frontendUrl,
      }).catch(() => { /* email failure should not block webhook */ });
    }
  } else {
    // ── Reactivation — tenant already exists ──
    tenantId = await resolveTenantId(customerId);
    if (!tenantId) return;

    const [tenantBefore] = await db
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (stripeSubId) {
      const [existingSub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
        .limit(1);

      if (existingSub) {
        await db
          .update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
      } else {
        const stripeSub = await getStripeSubscription(stripeSubId);
        const modules = await db
          .select({ productId: tenantModules.productId, moduleId: tenantModules.moduleId })
          .from(tenantModules)
          .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.status, "active")));

        const couponId = determineCouponId(modules);

        const [newSub] = await db
          .insert(subscriptions)
          .values({
            tenantId,
            stripeSubscriptionId: stripeSubId,
            status: "active",
            currentPeriodStart: new Date(stripeSub.start_date * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            stripeCouponId: couponId ?? null,
          })
          .returning();

        if (newSub) {
          for (const mod of modules) {
            const [plan] = await db
              .select()
              .from(plans)
              .where(
                and(
                  eq(plans.productId, mod.productId),
                  eq(plans.moduleId, mod.moduleId),
                  eq(plans.isActive, "true"),
                ),
              )
              .limit(1);

            if (plan) {
              const stripeItem = stripeSub.items.data.find(
                (si) => si.price.id === plan.stripePriceId,
              );

              await db.insert(subscriptionItems).values({
                subscriptionId: newSub.id,
                stripeItemId: stripeItem?.id ?? null,
                planId: plan.id,
                moduleId: mod.moduleId,
                productId: mod.productId,
                quantity: 1,
              });
            }
          }
        }
      }

      await db
        .update(tenants)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    }

    if (tenantBefore?.status === "suspended") {
      dispatchWebhook("tenant.reactivated", tenantId, {
        subscriptionId: stripeSubId,
      });
    }
  }

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    metadata: { sessionId: session.id, subscriptionId: stripeSubId },
  });

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: isNewSignup ? "tenant.created_from_checkout" : "subscription.reactivated",
    resourceType: "subscription",
    resourceId: stripeSubId ?? session.id,
    metadata: { tenantId, eventId: event.id },
  });
}

/**
 * Handle invoice.payment_succeeded — upsert invoice, log payment.
 */
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  invoiceData: Stripe.Event.Data.Object,
): Promise<void> {
  // Cast from Stripe's generic event data — validate required fields
  const invoice = invoiceData as unknown as Stripe.Invoice;
  if (!invoice.id || !invoice.customer) return;

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);
  if (!tenantId) return;

  const stripeInvoiceId = invoice.id;

  // Upsert invoice record
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (existing) {
    await db
      .update(invoices)
      .set({
        status: invoice.status ?? "paid",
        amountPaid: invoice.amount_paid,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      })
      .where(eq(invoices.id, existing.id));
  } else {
    await db.insert(invoices).values({
      tenantId,
      stripeInvoiceId,
      status: invoice.status ?? "paid",
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
    });
  }

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    metadata: { invoiceId: stripeInvoiceId },
  });

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: "invoice.paid",
    resourceType: "invoice",
    resourceId: stripeInvoiceId,
    metadata: { tenantId, amountPaid: invoice.amount_paid },
  });

  // Send payment received email
  const [paymentTenant] = await db
    .select({ name: tenants.name, billingEmail: tenants.billingEmail })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (paymentTenant?.billingEmail) {
    void sendPaymentReceivedEmail({
      to: paymentTenant.billingEmail,
      companyName: paymentTenant.name,
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : new Date().toISOString(),
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : new Date().toISOString(),
    }).catch(() => { /* email failure should not block webhook */ });
  }
}

/**
 * Handle invoice.payment_failed — update status to past_due.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  invoiceData: Stripe.Event.Data.Object,
): Promise<void> {
  const invoice = invoiceData as unknown as Stripe.Invoice;
  if (!invoice.id || !invoice.customer) return;

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);
  if (!tenantId) return;

  const stripeSubId = getSubscriptionIdFromInvoice(invoice);

  if (stripeSubId) {
    await db
      .update(subscriptions)
      .set({ status: "past_due", updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
  }

  dispatchWebhook("tenant.suspended", tenantId, {
    reason: "payment_failed",
    subscriptionId: stripeSubId,
  });

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    amountCents: invoice.amount_due,
    currency: invoice.currency,
    metadata: { invoiceId: invoice.id },
  });

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: "invoice.payment_failed",
    resourceType: "invoice",
    resourceId: invoice.id,
    metadata: { tenantId, amountDue: invoice.amount_due },
  });

  // Send payment failed email
  const [failedTenant] = await db
    .select({ name: tenants.name, billingEmail: tenants.billingEmail })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (failedTenant?.billingEmail) {
    void sendPaymentFailedEmail({
      to: failedTenant.billingEmail,
      companyName: failedTenant.name,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      retryDate: null,
      updatePaymentUrl: `${config.frontendUrl}/signup/cancelled`,
    }).catch(() => { /* email failure should not block webhook */ });
  }
}

/**
 * Handle customer.subscription.updated — sync status/periods.
 * Note: current_period_start/end were removed in Stripe API v2025-08-27.
 * We derive period start from start_date and track status changes.
 */
async function handleSubscriptionUpdated(
  event: Stripe.Event,
  subData: Stripe.Event.Data.Object,
): Promise<void> {
  const sub = subData as unknown as Stripe.Subscription;
  const customerId = getCustomerId(sub.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);

  // Check for status change before updating
  const [existingSub] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  const previousStatus = existingSub?.status ?? "unknown";

  await db
    .update(subscriptions)
    .set({
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    metadata: { subscriptionId: sub.id, status: sub.status },
  });

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: "subscription.updated",
    resourceType: "subscription",
    resourceId: sub.id,
    metadata: { tenantId, status: sub.status, previousStatus },
  });

  // Send plan changed email if status actually changed
  if (tenantId && previousStatus !== sub.status) {
    const [updatedTenant] = await db
      .select({ name: tenants.name, billingEmail: tenants.billingEmail })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (updatedTenant?.billingEmail) {
      void sendPlanChangedEmail({
        to: updatedTenant.billingEmail,
        companyName: updatedTenant.name,
        previousPlan: previousStatus,
        newPlan: sub.status,
        effectiveDate: new Date().toISOString(),
      }).catch(() => { /* email failure should not block webhook */ });
    }
  }
}

/**
 * Handle customer.subscription.deleted — cancel subscription + update tenant.
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  subData: Stripe.Event.Data.Object,
): Promise<void> {
  const sub = subData as unknown as Stripe.Subscription;
  const customerId = getCustomerId(sub.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);

  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));

  if (tenantId) {
    await db
      .update(tenants)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    dispatchWebhook("tenant.cancelled", tenantId, {
      subscriptionId: sub.id,
    });

    // Send account suspended email
    const [suspendedTenant] = await db
      .select({ name: tenants.name, billingEmail: tenants.billingEmail })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (suspendedTenant?.billingEmail) {
      void sendAccountSuspendedEmail({
        to: suspendedTenant.billingEmail,
        companyName: suspendedTenant.name,
        reactivateUrl: `${config.frontendUrl}/signup`,
      }).catch(() => { /* email failure should not block webhook */ });
    }
  }

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    metadata: { subscriptionId: sub.id },
  });

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: "subscription.deleted",
    resourceType: "subscription",
    resourceId: sub.id,
    metadata: { tenantId },
  });
}

/**
 * Handle customer.subscription.trial_will_end — send trial ending reminder.
 * Stripe fires this 3 days before trial ends.
 */
async function handleTrialWillEnd(
  event: Stripe.Event,
  subData: Stripe.Event.Data.Object,
): Promise<void> {
  const sub = subData as unknown as Stripe.Subscription;
  const customerId = getCustomerId(sub.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);

  await logBillingEvent({
    tenantId,
    eventType: event.type,
    stripeEventId: event.id,
    metadata: { subscriptionId: sub.id },
  });

  if (tenantId) {
    const [tenant] = await db
      .select({ name: tenants.name, billingEmail: tenants.billingEmail })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant?.billingEmail) {
      const trialEnd = sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : new Date().toISOString();

      void sendTrialEndingEmail({
        to: tenant.billingEmail,
        companyName: tenant.name,
        trialEndDate: trialEnd,
        upgradeUrl: `${config.frontendUrl}/account/billing`,
      }).catch(() => { /* email failure should not block webhook */ });
    }
  }

  await db.insert(auditLog).values({
    actorId: "stripe",
    actorType: "system",
    action: "subscription.trial_ending",
    resourceType: "subscription",
    resourceId: sub.id,
    metadata: { tenantId },
  });
}

/**
 * Stripe webhook route — registered at app root level.
 * Needs its own scope for raw body parsing.
 */
export async function stripeWebhookRoute(app: FastifyInstance): Promise<void> {
  // Register raw body content type parser for webhook signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.post("/api/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_SIGNATURE", message: "Missing stripe-signature header" },
      });
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(request.body as Buffer, signature);
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" },
      });
    }

    // Idempotency check
    if (await isEventProcessed(event.id)) {
      return reply.status(200).send({ success: true, message: "Event already processed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event, event.data.object);
          break;
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event, event.data.object);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event, event.data.object);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event, event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event, event.data.object);
          break;
        case "customer.subscription.trial_will_end":
          await handleTrialWillEnd(event, event.data.object);
          break;
        default:
          app.log.info(`Unhandled Stripe event type: ${event.type}`);
          await logBillingEvent({
            tenantId: null,
            eventType: event.type,
            stripeEventId: event.id,
            metadata: {},
          });
      }
    } catch (error) {
      app.log.error({ err: error, eventType: event.type }, "Webhook handler error");
      return reply.status(500).send({
        success: false,
        error: { code: "WEBHOOK_ERROR", message: "Error processing webhook event" },
      });
    }

    return reply.status(200).send({ success: true });
  });
}
