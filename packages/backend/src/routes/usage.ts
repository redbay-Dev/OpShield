import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenantModules, auditLog } from "../db/schema/tenants.js";
import {
  tenantUsage,
  subscriptions,
  subscriptionItems,
  plans,
} from "../db/schema/billing.js";
import {
  requireServiceAuth,
  type ServiceKeyAuth,
} from "../middleware/require-service-auth.js";
import { usageReportSchema } from "@opshield/shared/schemas";
import { dispatchWebhookToProduct } from "../services/webhook.js";
import { updateStripeSubscription } from "../services/stripe.js";

/**
 * Detect if user count exceeds included users and update Stripe subscription
 * quantity for the per-user line item accordingly.
 */
async function syncOverageToStripe(
  tenantId: string,
  moduleId: string,
  productId: string,
  newUserCount: number,
  _log: { warn: (msg: string) => void },
): Promise<void> {
  // Find the tenant's active subscription
  const [sub] = await db
    .select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);

  if (!sub) return;

  // Find the subscription item for this module
  const [subItem] = await db
    .select({
      id: subscriptionItems.id,
      planId: subscriptionItems.planId,
      stripeItemId: subscriptionItems.stripeItemId,
    })
    .from(subscriptionItems)
    .where(
      and(
        eq(subscriptionItems.subscriptionId, sub.id),
        eq(subscriptionItems.moduleId, moduleId),
        eq(subscriptionItems.productId, productId),
      ),
    )
    .limit(1);

  if (!subItem) return;

  // Look up the plan to get includedUsers and per-user price info
  const [plan] = await db
    .select({
      includedUsers: plans.includedUsers,
      stripePerUserPriceId: plans.stripePerUserPriceId,
    })
    .from(plans)
    .where(eq(plans.id, subItem.planId))
    .limit(1);

  if (!plan?.stripePerUserPriceId) return;

  // Calculate overage users
  const overageUsers = Math.max(0, newUserCount - plan.includedUsers);

  // Update tenantModules.maxUsers to reflect actual usage for limit tracking
  await db
    .update(tenantModules)
    .set({ maxUsers: Math.max(plan.includedUsers, newUserCount), updatedAt: new Date() })
    .where(
      and(
        eq(tenantModules.tenantId, tenantId),
        eq(tenantModules.moduleId, moduleId),
        eq(tenantModules.productId, productId),
      ),
    );

  // Find existing per-user Stripe item on the subscription
  // We look for a subscription item with the per-user price
  const stripeSubscription = await import("../services/stripe.js").then(
    (m) => m.getStripeSubscription(sub.stripeSubscriptionId),
  );

  const perUserItem = stripeSubscription.items.data.find(
    (item) => item.price.id === plan.stripePerUserPriceId,
  );

  if (perUserItem) {
    // Update existing per-user item quantity
    if (overageUsers === 0) {
      // No overage — remove the per-user item
      await import("../services/stripe.js").then((m) =>
        m.stripe.subscriptionItems.del(perUserItem.id, {
          proration_behavior: "create_prorations",
        }),
      );
    } else if (perUserItem.quantity !== overageUsers) {
      // Update quantity
      await updateStripeSubscription(sub.stripeSubscriptionId, {
        updateItems: [{ id: perUserItem.id, quantity: overageUsers }],
      });
    }
  } else if (overageUsers > 0) {
    // Add per-user item to subscription
    await updateStripeSubscription(sub.stripeSubscriptionId, {
      addItems: [{ price: plan.stripePerUserPriceId, quantity: overageUsers }],
    });
  }

  // Audit the overage change
  await db.insert(auditLog).values({
    actorId: "system",
    actorType: "system",
    action: "usage.overage_synced",
    resourceType: "tenant",
    resourceId: tenantId,
    metadata: {
      moduleId,
      productId,
      userCount: newUserCount,
      includedUsers: plan.includedUsers,
      overageUsers,
    },
  });
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /usage — Report usage metrics from product backends.
   * Authenticated via service API key. Product must match reported productId.
   */
  app.post(
    "/usage",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const bodyParsed = usageReportSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid usage report",
            details: bodyParsed.error.issues,
          },
        });
      }

      const { tenantId, productId, moduleId, metric, value, breakdown } =
        bodyParsed.data;

      // Verify the service key's productId matches the reported productId
      const serviceKey = (
        request as FastifyRequest & { serviceKey?: ServiceKeyAuth }
      ).serviceKey;

      if (serviceKey && serviceKey.productId !== productId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Service key product does not match reported product",
          },
        });
      }

      // Verify the module exists for this tenant
      const [mod] = await db
        .select({ id: tenantModules.id, maxUsers: tenantModules.maxUsers })
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.moduleId, moduleId),
            eq(tenantModules.productId, productId),
          ),
        )
        .limit(1);

      if (!mod) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Module "${moduleId}" not found for tenant`,
          },
        });
      }

      // Insert usage record (append-only)
      await db.insert(tenantUsage).values({
        tenantId,
        productId,
        moduleId,
        metric,
        value,
        breakdown: breakdown ?? {},
        reportedBy: serviceKey ? `service:${serviceKey.productId}` : "admin",
      });

      // Update currentUsers on tenantModules
      await db
        .update(tenantModules)
        .set({ currentUsers: value, updatedAt: new Date() })
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.moduleId, moduleId),
          ),
        );

      // Sync overage to Stripe if user count metric
      if (metric === "user_count") {
        void syncOverageToStripe(tenantId, moduleId, productId, value, app.log)
          .catch((err: unknown) => {
            app.log.error(
              { tenantId, moduleId, err: err instanceof Error ? err.message : String(err) },
              "Failed to sync overage to Stripe",
            );
          });
      }

      // Fire webhook back to reporting product
      dispatchWebhookToProduct(productId, "user_count.updated", tenantId, {
        moduleId,
        userCount: value,
        maxUsers: mod.maxUsers,
      });

      return reply.status(201).send({
        success: true,
        data: { tenantId, productId, moduleId, metric, value },
      });
    },
  );
}
