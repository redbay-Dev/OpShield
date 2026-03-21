import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantModules, auditLog } from "../db/schema/tenants.js";
import {
  subscriptions,
  subscriptionItems,
  plans,
} from "../db/schema/billing.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { getSession } from "../middleware/auth.js";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  tenantIdParamSchema,
} from "@opshield/shared/schemas";
import {
  createStripeCustomer,
  createStripeSubscription,
  cancelStripeSubscription,
  getStripeSubscription,
  updateStripeSubscription,
} from "../services/stripe.js";
import { determineCouponId } from "../services/billing-utils.js";

function formatSubscription(
  sub: typeof subscriptions.$inferSelect,
  items: Array<typeof subscriptionItems.$inferSelect>,
): Record<string, unknown> {
  return {
    id: sub.id,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeCouponId: sub.stripeCouponId,
    items: items.map((item) => ({
      id: item.id,
      stripeItemId: item.stripeItemId,
      planId: item.planId,
      moduleId: item.moduleId,
      productId: item.productId,
      quantity: item.quantity,
    })),
    createdAt: sub.createdAt.toISOString(),
  };
}

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /tenants/:tenantId/subscription — Create subscription ──
  app.post(
    "/tenants/:tenantId/subscription",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = createSubscriptionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: bodyParsed.error.issues,
          },
        });
      }

      const { tenantId } = paramParsed.data;
      const { billingInterval, trialPeriodDays } = bodyParsed.data;

      // Check tenant exists
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      // Ensure no existing active subscription
      const [existingSub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);

      if (existingSub) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "CONFLICT",
            message: "Tenant already has an active subscription",
          },
        });
      }

      // Load active tenant modules
      const modules = await db
        .select()
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.status, "active"),
          ),
        );

      if (modules.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "NO_MODULES",
            message: "Tenant has no active modules. Add modules before creating a subscription.",
          },
        });
      }

      // Look up plans for each module and billing interval
      const modulePlans: Array<{
        module: typeof modules[number];
        plan: typeof plans.$inferSelect;
      }> = [];

      for (const mod of modules) {
        const [plan] = await db
          .select()
          .from(plans)
          .where(
            and(
              eq(plans.productId, mod.productId),
              eq(plans.moduleId, mod.moduleId),
              eq(plans.billingInterval, billingInterval),
              eq(plans.isActive, "true"),
            ),
          )
          .limit(1);

        if (!plan) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "NO_PLAN",
              message: `No ${billingInterval} plan found for module ${mod.moduleId}`,
            },
          });
        }

        if (!plan.stripePriceId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "STRIPE_NOT_CONFIGURED",
              message: `Plan for ${mod.moduleId} has no Stripe price ID. Run price sync first.`,
            },
          });
        }

        modulePlans.push({ module: mod, plan });
      }

      // Create Stripe customer if needed
      let stripeCustomerId = tenant.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await createStripeCustomer(
          tenant.name,
          tenant.billingEmail ?? "",
          { tenantId: tenant.id, tenantSlug: tenant.slug },
        );
        stripeCustomerId = customer.id;

        await db
          .update(tenants)
          .set({ stripeCustomerId, updatedAt: new Date() })
          .where(eq(tenants.id, tenantId));
      }

      // Build Stripe line items — stripePriceId is guaranteed non-null by validation above
      const stripeItems: Array<{ price: string; quantity?: number }> = [];
      for (const { module: mod, plan } of modulePlans) {
        // Base price item (validated non-null above)
        const basePriceId = plan.stripePriceId;
        if (!basePriceId) continue;
        stripeItems.push({ price: basePriceId });

        // Per-user item if applicable (extra users beyond included)
        if (plan.stripePerUserPriceId && mod.maxUsers > plan.includedUsers) {
          stripeItems.push({
            price: plan.stripePerUserPriceId,
            quantity: mod.maxUsers - plan.includedUsers,
          });
        }
      }

      // Determine coupon
      const couponId = determineCouponId(modules);

      // Create Stripe subscription
      const stripeSub = await createStripeSubscription(
        stripeCustomerId,
        stripeItems,
        couponId,
        trialPeriodDays,
        { tenantId, tenantSlug: tenant.slug },
      );

      // Insert local subscription record
      // Note: current_period_start/end removed in Stripe API v2025-08-27
      // Period info will be synced from invoice events
      const [sub] = await db
        .insert(subscriptions)
        .values({
          tenantId,
          stripeSubscriptionId: stripeSub.id,
          status: stripeSub.status,
          currentPeriodStart: new Date(stripeSub.start_date * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          stripeCouponId: couponId ?? null,
        })
        .returning();

      if (!sub) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create subscription" },
        });
      }

      // Insert subscription items
      const itemRecords: Array<typeof subscriptionItems.$inferSelect> = [];
      let stripeItemIndex = 0;
      for (const { module: mod, plan } of modulePlans) {
        const stripeItem = stripeSub.items.data[stripeItemIndex];
        const [item] = await db
          .insert(subscriptionItems)
          .values({
            subscriptionId: sub.id,
            stripeItemId: stripeItem?.id ?? null,
            planId: plan.id,
            moduleId: mod.moduleId,
            productId: mod.productId,
            quantity: 1,
          })
          .returning();

        if (item) {
          itemRecords.push(item);
        }
        stripeItemIndex++;

        // Skip per-user item index if present
        if (plan.stripePerUserPriceId && mod.maxUsers > plan.includedUsers) {
          stripeItemIndex++;
        }
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "subscription.created",
        resourceType: "subscription",
        resourceId: sub.id,
        metadata: {
          tenantId,
          stripeSubscriptionId: stripeSub.id,
          billingInterval,
          moduleCount: modules.length,
          couponId,
        },
      });

      return reply.status(201).send({
        success: true,
        data: formatSubscription(sub, itemRecords),
      });
    },
  );

  // ── GET /tenants/:tenantId/subscription — Get subscription details ──
  app.get(
    "/tenants/:tenantId/subscription",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const { tenantId } = paramParsed.data;

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .orderBy(subscriptions.createdAt)
        .limit(1);

      if (!sub) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "No subscription found for tenant" },
        });
      }

      const items = await db
        .select()
        .from(subscriptionItems)
        .where(eq(subscriptionItems.subscriptionId, sub.id));

      // Optionally enrich from Stripe for live status
      try {
        const stripeSub = await getStripeSubscription(sub.stripeSubscriptionId);
        if (stripeSub.status !== sub.status) {
          await db
            .update(subscriptions)
            .set({
              status: stripeSub.status,
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, sub.id));

          sub.status = stripeSub.status;
          sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
        }
      } catch {
        // If Stripe is unreachable, return local data
      }

      return reply.send({
        success: true,
        data: formatSubscription(sub, items),
      });
    },
  );

  // ── PATCH /tenants/:tenantId/subscription — Update subscription ──
  app.patch(
    "/tenants/:tenantId/subscription",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const { tenantId } = paramParsed.data;

      // Find active subscription
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);

      if (!sub) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "No active subscription found" },
        });
      }

      // Get current subscription items
      const currentItems = await db
        .select()
        .from(subscriptionItems)
        .where(eq(subscriptionItems.subscriptionId, sub.id));

      // Load current active modules
      const modules = await db
        .select()
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.status, "active"),
          ),
        );

      const currentModuleIds = new Set(currentItems.map((i) => i.moduleId));
      const activeModuleIds = new Set(modules.map((m) => m.moduleId));

      // Find modules to add and remove
      const modulesToAdd = modules.filter((m) => !currentModuleIds.has(m.moduleId));
      const itemsToRemove = currentItems.filter((i) => !activeModuleIds.has(i.moduleId));

      const addStripeItems: Array<{ price: string; quantity?: number }> = [];
      const newItemRecords: Array<{
        planId: string;
        moduleId: string;
        productId: string;
      }> = [];

      // Look up plans for new modules using the existing subscription's billing interval
      // Determine interval from existing plan
      const existingItem = currentItems[0];
      let billingInterval = "monthly";
      if (existingItem) {
        const [existingPlan] = await db
          .select()
          .from(plans)
          .where(eq(plans.id, existingItem.planId))
          .limit(1);
        if (existingPlan) {
          billingInterval = existingPlan.billingInterval;
        }
      }

      for (const mod of modulesToAdd) {
        const [plan] = await db
          .select()
          .from(plans)
          .where(
            and(
              eq(plans.productId, mod.productId),
              eq(plans.moduleId, mod.moduleId),
              eq(plans.billingInterval, billingInterval),
              eq(plans.isActive, "true"),
            ),
          )
          .limit(1);

        if (!plan?.stripePriceId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "NO_PLAN",
              message: `No plan/price found for module ${mod.moduleId}`,
            },
          });
        }

        addStripeItems.push({ price: plan.stripePriceId });
        newItemRecords.push({
          planId: plan.id,
          moduleId: mod.moduleId,
          productId: mod.productId,
        });
      }

      const removeStripeItemIds = itemsToRemove
        .filter((i) => i.stripeItemId)
        .map((i) => i.stripeItemId as string);

      // Determine new coupon
      const couponId = determineCouponId(modules);

      // Update Stripe
      await updateStripeSubscription(sub.stripeSubscriptionId, {
        addItems: addStripeItems.length > 0 ? addStripeItems : undefined,
        removeItems: removeStripeItemIds.length > 0 ? removeStripeItemIds : undefined,
        couponId: couponId ?? "",
      });

      // Remove local items
      for (const item of itemsToRemove) {
        await db
          .delete(subscriptionItems)
          .where(eq(subscriptionItems.id, item.id));
      }

      // Add local items
      for (const record of newItemRecords) {
        await db.insert(subscriptionItems).values({
          subscriptionId: sub.id,
          planId: record.planId,
          moduleId: record.moduleId,
          productId: record.productId,
          quantity: 1,
        });
      }

      // Update coupon
      await db
        .update(subscriptions)
        .set({ stripeCouponId: couponId ?? null, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));

      // Reload items
      const updatedItems = await db
        .select()
        .from(subscriptionItems)
        .where(eq(subscriptionItems.subscriptionId, sub.id));

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "subscription.updated",
        resourceType: "subscription",
        resourceId: sub.id,
        metadata: {
          tenantId,
          added: modulesToAdd.map((m) => m.moduleId),
          removed: itemsToRemove.map((i) => i.moduleId),
          couponId,
        },
      });

      return reply.send({
        success: true,
        data: formatSubscription(sub, updatedItems),
      });
    },
  );

  // ── DELETE /tenants/:tenantId/subscription — Cancel at period end ──
  app.delete(
    "/tenants/:tenantId/subscription",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = cancelSubscriptionSchema.safeParse(request.body ?? {});
      const atPeriodEnd = bodyParsed.success ? bodyParsed.data.atPeriodEnd : true;

      const { tenantId } = paramParsed.data;

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);

      if (!sub) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "No active subscription found" },
        });
      }

      // Cancel in Stripe
      await cancelStripeSubscription(sub.stripeSubscriptionId, atPeriodEnd);

      // Update local
      if (atPeriodEnd) {
        await db
          .update(subscriptions)
          .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
      } else {
        await db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "subscription.canceled",
        resourceType: "subscription",
        resourceId: sub.id,
        metadata: { tenantId, atPeriodEnd },
      });

      return reply.send({ success: true });
    },
  );
}
