import type { FastifyInstance } from "fastify";
import { eq, and, isNull, sql, count, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema/tenants.js";
import { subscriptions, subscriptionItems, plans } from "../db/schema/billing.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/analytics/revenue",
    { preHandler: [requirePlatformAdmin] },
    async () => {
      // Active subscriptions with items
      const activeSubscriptions = await db
        .select({
          id: subscriptions.id,
          tenantId: subscriptions.tenantId,
          status: subscriptions.status,
          stripeCouponId: subscriptions.stripeCouponId,
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));

      // All subscription items joined with plans for pricing
      const items = await db
        .select({
          subscriptionId: subscriptionItems.subscriptionId,
          productId: subscriptionItems.productId,
          moduleId: subscriptionItems.moduleId,
          quantity: subscriptionItems.quantity,
          basePrice: plans.basePrice,
          perUserPrice: plans.perUserPrice,
          includedUsers: plans.includedUsers,
        })
        .from(subscriptionItems)
        .innerJoin(plans, eq(subscriptionItems.planId, plans.id));

      // Calculate MRR: sum of (basePrice + max(0, quantity - includedUsers) * perUserPrice)
      let mrr = 0;
      const revenueByProduct: Record<string, number> = {};
      const revenueByModule: Record<string, number> = {};

      const activeSubIds = new Set(activeSubscriptions.map((s) => s.id));

      for (const item of items) {
        if (!activeSubIds.has(item.subscriptionId)) continue;

        const base = Number(item.basePrice ?? 0);
        const perUser = Number(item.perUserPrice ?? 0);
        const included = item.includedUsers ?? 0;
        const extra = Math.max(0, item.quantity - included);
        const lineTotal = base + extra * perUser;

        mrr += lineTotal;
        revenueByProduct[item.productId] = (revenueByProduct[item.productId] ?? 0) + lineTotal;
        revenueByModule[item.moduleId] = (revenueByModule[item.moduleId] ?? 0) + lineTotal;
      }

      // Apply coupon discounts to MRR
      for (const sub of activeSubscriptions) {
        if (sub.stripeCouponId === "bundle_2_products") {
          mrr *= 0.9; // 10% off
        } else if (sub.stripeCouponId === "bundle_3_plus") {
          mrr *= 0.85; // 15% off
        }
      }

      // Tenant counts
      const [tenantCounts] = await db
        .select({
          total: count(),
          active: count(sql`CASE WHEN ${tenants.status} = 'active' THEN 1 END`),
          onboarding: count(sql`CASE WHEN ${tenants.status} = 'onboarding' THEN 1 END`),
          suspended: count(sql`CASE WHEN ${tenants.status} = 'suspended' THEN 1 END`),
          cancelled: count(sql`CASE WHEN ${tenants.status} = 'cancelled' THEN 1 END`),
          trial: count(sql`CASE WHEN ${tenants.status} = 'trial' THEN 1 END`),
        })
        .from(tenants)
        .where(isNull(tenants.deletedAt));

      const activeTenants = tenantCounts?.active ?? 0;
      const arpu = activeTenants > 0 ? mrr / activeTenants : 0;

      // Churn: cancelled in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [cancelledResult] = await db
        .select({ count: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "canceled"),
            gte(subscriptions.updatedAt, thirtyDaysAgo),
          ),
        );

      const cancelledCount = cancelledResult?.count ?? 0;
      const totalAtStart = activeTenants + cancelledCount;
      const churnRate = totalAtStart > 0 ? (cancelledCount / totalAtStart) * 100 : 0;

      return {
        success: true,
        data: {
          mrr: Math.round(mrr * 100) / 100,
          activeTenants,
          churnRate: Math.round(churnRate * 10) / 10,
          arpu: Math.round(arpu * 100) / 100,
          revenueByProduct: Object.entries(revenueByProduct).map(([productId, amount]) => ({
            productId,
            amount: Math.round(amount * 100) / 100,
          })),
          revenueByModule: Object.entries(revenueByModule).map(([moduleId, amount]) => ({
            moduleId,
            amount: Math.round(amount * 100) / 100,
          })),
          tenantCounts: {
            total: tenantCounts?.total ?? 0,
            active: activeTenants,
            onboarding: tenantCounts?.onboarding ?? 0,
            suspended: tenantCounts?.suspended ?? 0,
            cancelled: tenantCounts?.cancelled ?? 0,
            trial: tenantCounts?.trial ?? 0,
          },
        },
      };
    },
  );
}
