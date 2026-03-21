import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
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
import { constructWebhookEvent, getStripeSubscription } from "../services/stripe.js";
import { dispatchWebhook } from "../services/webhook.js";
import { provisionTenant } from "../services/provisioning.js";
import { determineCouponId } from "../services/billing-utils.js";

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
 * Handle checkout.session.completed — activate subscription, set tenant active,
 * upsert local subscription records, trigger provisioning.
 */
async function handleCheckoutCompleted(
  event: Stripe.Event,
  sessionData: Stripe.Event.Data.Object,
): Promise<void> {
  const session = sessionData as unknown as Stripe.Checkout.Session;
  if (!session.customer) return;

  const customerId = getCustomerId(session.customer);
  if (!customerId) return;

  const tenantId = await resolveTenantId(customerId);
  if (!tenantId) return;

  const stripeSubId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  // Capture tenant status before update for reactivation detection
  const [tenantBefore] = await db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const wasSuspended = tenantBefore?.status === "suspended";
  const wasOnboarding = tenantBefore?.status === "onboarding";

  if (stripeSubId) {
    // Upsert local subscription — may not exist yet (self-service checkout creates
    // the Stripe subscription via Checkout Session, not our admin endpoint)
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
      // Create local subscription from Stripe data
      const stripeSub = await getStripeSubscription(stripeSubId);

      // Determine coupon from tenant's active modules
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

      // Create subscription items from tenant modules + plan lookups
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
            // Find matching Stripe item
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

  if (wasSuspended) {
    dispatchWebhook("tenant.reactivated", tenantId, {
      subscriptionId: stripeSubId,
    });
  }

  // Trigger provisioning for new sign-ups (tenant was onboarding → now active)
  if (wasOnboarding) {
    const userId = session.metadata?.userId ?? undefined;
    void provisionTenant(tenantId, {
      ownerUserId: userId,
    });
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
    action: "subscription.activated",
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
    metadata: { tenantId, status: sub.status },
  });
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
