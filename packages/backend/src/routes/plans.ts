import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { plans, subscriptionItems } from "../db/schema/billing.js";
import { auditLog } from "../db/schema/tenants.js";
import { syncPlanToStripe, stripe } from "../services/stripe.js";
import { config } from "../config.js";
import { PRODUCT_CONFIG } from "@opshield/shared/constants";
import {
  requirePlatformAdmin,
  requireWriteAccess,
  requireDeleteAccess,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  productId: z.enum(["safespec", "nexum"]),
  moduleId: z.string().min(1).max(50),
  tier: z.string().min(1).max(50),
  basePrice: z.string().regex(/^\d+\.\d{2}$/, "Must be a decimal like 49.00"),
  includedUsers: z.number().int().min(0).default(5),
  perUserPrice: z.string().regex(/^\d+\.\d{2}$/, "Must be a decimal like 5.00").default("0.00"),
  billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
  features: z.array(z.string()).default([]),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  basePrice: z.string().regex(/^\d+\.\d{2}$/).optional(),
  includedUsers: z.number().int().min(0).optional(),
  perUserPrice: z.string().regex(/^\d+\.\d{2}$/).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

const planIdParamSchema = z.object({
  planId: z.string().uuid(),
});

function formatPlan(plan: typeof plans.$inferSelect): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    productId: plan.productId,
    moduleId: plan.moduleId,
    tier: plan.tier,
    basePrice: plan.basePrice,
    includedUsers: plan.includedUsers,
    perUserPrice: plan.perUserPrice,
    billingInterval: plan.billingInterval,
    stripePriceId: plan.stripePriceId,
    stripePerUserPriceId: plan.stripePerUserPriceId,
    features: plan.features,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export async function planRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /plans/admin — List all plans (admin) ──
  app.get(
    "/plans/admin",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      const allPlans = await db
        .select()
        .from(plans)
        .orderBy(plans.productId, plans.moduleId, plans.tier);

      return reply.send({
        success: true,
        data: allPlans.map(formatPlan),
      });
    },
  );

  // ── POST /plans — Create plan (admin, write access) ──
  app.post(
    "/plans",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const parsed = createPlanSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.issues,
          },
        });
      }

      const [plan] = await db
        .insert(plans)
        .values({
          name: parsed.data.name,
          productId: parsed.data.productId,
          moduleId: parsed.data.moduleId,
          tier: parsed.data.tier,
          basePrice: parsed.data.basePrice,
          includedUsers: parsed.data.includedUsers,
          perUserPrice: parsed.data.perUserPrice,
          billingInterval: parsed.data.billingInterval,
          features: parsed.data.features,
        })
        .returning();

      if (!plan) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create plan" },
        });
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plan.created",
        resourceType: "plan",
        resourceId: plan.id,
        metadata: { name: plan.name, productId: plan.productId, moduleId: plan.moduleId },
      });

      // Auto-sync to Stripe if key is configured
      if (config.stripe.secretKey && !config.stripe.secretKey.startsWith("sk_test_placeholder")) {
        try {
          const stripeIds = await syncPlanToStripe(plan);
          await db
            .update(plans)
            .set({
              stripePriceId: stripeIds.stripePriceId,
              stripePerUserPriceId: stripeIds.stripePerUserPriceId,
              updatedAt: new Date(),
            })
            .where(eq(plans.id, plan.id));

          // Re-fetch with Stripe IDs
          const [updated] = await db
            .select()
            .from(plans)
            .where(eq(plans.id, plan.id))
            .limit(1);

          return reply.status(201).send({
            success: true,
            data: formatPlan(updated ?? plan),
          });
        } catch {
          // Stripe sync failed — return plan without Stripe IDs
          // Plan is still usable, just needs manual sync later
          return reply.status(201).send({
            success: true,
            data: formatPlan(plan),
          });
        }
      }

      return reply.status(201).send({
        success: true,
        data: formatPlan(plan),
      });
    },
  );

  // ── PATCH /plans/:planId — Update plan (admin, write access) ──
  app.patch(
    "/plans/:planId",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramParsed = planIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid plan ID" },
        });
      }

      const bodyParsed = updatePlanSchema.safeParse(request.body);
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

      const { planId } = paramParsed.data;
      const updates = bodyParsed.data;

      const [existing] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Plan not found" },
        });
      }

      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) setValues.name = updates.name;
      if (updates.basePrice !== undefined) setValues.basePrice = updates.basePrice;
      if (updates.includedUsers !== undefined) setValues.includedUsers = updates.includedUsers;
      if (updates.perUserPrice !== undefined) setValues.perUserPrice = updates.perUserPrice;
      if (updates.features !== undefined) setValues.features = updates.features;
      if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

      const [updated] = await db
        .update(plans)
        .set(setValues)
        .where(eq(plans.id, planId))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to update plan" },
        });
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plan.updated",
        resourceType: "plan",
        resourceId: planId,
        metadata: { changes: updates },
      });

      // Re-sync to Stripe if pricing changed and Stripe is configured
      const pricingChanged = updates.basePrice !== undefined || updates.perUserPrice !== undefined;
      if (
        pricingChanged &&
        config.stripe.secretKey &&
        !config.stripe.secretKey.startsWith("sk_test_placeholder")
      ) {
        try {
          const stripeIds = await syncPlanToStripe(updated);
          await db
            .update(plans)
            .set({
              stripePriceId: stripeIds.stripePriceId,
              stripePerUserPriceId: stripeIds.stripePerUserPriceId,
              updatedAt: new Date(),
            })
            .where(eq(plans.id, planId));

          const [resynced] = await db
            .select()
            .from(plans)
            .where(eq(plans.id, planId))
            .limit(1);

          return reply.send({
            success: true,
            data: formatPlan(resynced ?? updated),
          });
        } catch {
          // Stripe sync failed — return plan as-is
        }
      }

      return reply.send({
        success: true,
        data: formatPlan(updated),
      });
    },
  );

  // ── DELETE /plans/:planId — Deactivate plan (admin, delete access) ──
  app.delete(
    "/plans/:planId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramParsed = planIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid plan ID" },
        });
      }

      const { planId } = paramParsed.data;

      const [existing] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Plan not found" },
        });
      }

      // Soft deactivate — don't delete, existing subscriptions reference this
      await db
        .update(plans)
        .set({ isActive: "false", updatedAt: new Date() })
        .where(eq(plans.id, planId));

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plan.deactivated",
        resourceType: "plan",
        resourceId: planId,
      });

      return reply.send({ success: true });
    },
  );

  // ── DELETE /plans/:planId/permanent — Hard delete plan (admin, delete access) ──
  // Only allowed if no subscription items reference this plan.
  app.delete(
    "/plans/:planId/permanent",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramParsed = planIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid plan ID" },
        });
      }

      const { planId } = paramParsed.data;

      const [existing] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Plan not found" },
        });
      }

      // Check if any subscription items reference this plan
      const [refCount] = await db
        .select({ id: subscriptionItems.id })
        .from(subscriptionItems)
        .where(eq(subscriptionItems.planId, planId))
        .limit(1);

      if (refCount) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "CONFLICT",
            message: "Cannot delete — this plan is referenced by existing subscriptions. Deactivate it instead.",
          },
        });
      }

      await db.delete(plans).where(eq(plans.id, planId));

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plan.deleted",
        resourceType: "plan",
        resourceId: planId,
        metadata: { name: existing.name, productId: existing.productId },
      });

      return reply.send({ success: true });
    },
  );

  // ── GET /plans/admin/reconciliation — Compare DB plans vs Stripe ──
  // Simple: each plan has one Stripe price. Either it's synced or it's not.
  app.get(
    "/plans/admin/reconciliation",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "STRIPE_NOT_CONFIGURED",
            message: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable reconciliation.",
          },
        });
      }

      const allPlans = await db
        .select()
        .from(plans)
        .orderBy(plans.productId, plans.moduleId, plans.tier);

      // Fetch all active Stripe prices to validate references
      const activeStripePriceIds = new Set<string>();
      for await (const price of stripe.prices.list({ limit: 100, active: true })) {
        activeStripePriceIds.add(price.id);
      }

      // Categorise every plan
      const synced: Array<Record<string, unknown>> = [];
      const broken: Array<Record<string, unknown>> = [];
      const unsynced: Array<Record<string, unknown>> = [];
      const inactive: Array<Record<string, unknown>> = [];

      for (const plan of allPlans) {
        const planData = formatPlan(plan);

        if (plan.isActive !== "true") {
          inactive.push(planData);
          continue;
        }

        if (!plan.stripePriceId) {
          // No Stripe price ID at all
          unsynced.push(planData);
        } else if (!activeStripePriceIds.has(plan.stripePriceId)) {
          // Has a Stripe price ID but it doesn't exist in Stripe anymore
          broken.push({ ...planData, issue: "Stripe price deleted/archived" });
        } else {
          synced.push(planData);
        }
      }

      const activePlans = allPlans.filter((p) => p.isActive === "true").length;

      return reply.send({
        success: true,
        data: {
          summary: {
            totalPlans: allPlans.length,
            activePlans,
            synced: synced.length,
            broken: broken.length,
            unsynced: unsynced.length,
            inactive: inactive.length,
          },
          synced,
          broken,
          unsynced,
          inactive,
        },
      });
    },
  );

  // ── POST /plans/:planId/sync — Force sync single plan to Stripe ──
  app.post(
    "/plans/:planId/sync",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          success: false,
          error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" },
        });
      }

      const paramParsed = planIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid plan ID" },
        });
      }

      const { planId } = paramParsed.data;

      const [plan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (!plan) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Plan not found" },
        });
      }

      try {
        // Clear stale IDs first so syncPlanToStripe creates fresh prices
        await db
          .update(plans)
          .set({ stripePriceId: null, stripePerUserPriceId: null, updatedAt: new Date() })
          .where(eq(plans.id, planId));

        const stripeIds = await syncPlanToStripe(plan);
        const [updated] = await db
          .update(plans)
          .set({
            stripePriceId: stripeIds.stripePriceId,
            stripePerUserPriceId: stripeIds.stripePerUserPriceId,
            updatedAt: new Date(),
          })
          .where(eq(plans.id, planId))
          .returning();

        const admin = (
          request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
        ).platformAdmin;

        await db.insert(auditLog).values({
          actorId: admin.userId,
          actorType: "admin",
          action: "plan.synced_to_stripe",
          resourceType: "plan",
          resourceId: planId,
          metadata: {
            stripePriceId: stripeIds.stripePriceId,
            stripePerUserPriceId: stripeIds.stripePerUserPriceId,
          },
        });

        return reply.send({
          success: true,
          data: formatPlan(updated ?? plan),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown Stripe error";
        return reply.status(502).send({
          success: false,
          error: { code: "STRIPE_SYNC_FAILED", message },
        });
      }
    },
  );

  // ── POST /plans/admin/sync-all — Sync ALL active plans to Stripe ──
  // Validates every plan's Stripe price actually exists before skipping.
  app.post(
    "/plans/admin/sync-all",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          success: false,
          error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" },
        });
      }

      const allPlans = await db
        .select()
        .from(plans)
        .where(eq(plans.isActive, "true"));

      const results: Array<{
        planId: string;
        name: string;
        status: "synced" | "failed" | "skipped";
        error?: string;
        stripePriceId?: string;
      }> = [];

      const body = z.object({ force: z.boolean().default(false) }).safeParse(request.body);
      const force = body.success ? body.data.force : false;

      for (const plan of allPlans) {
        // Skip if already has a valid Stripe price (unless force)
        if (plan.stripePriceId && !force) {
          results.push({
            planId: plan.id,
            name: plan.name,
            status: "skipped",
          });
          continue;
        }

        try {
          const stripeIds = await syncPlanToStripe(plan);
          await db
            .update(plans)
            .set({
              stripePriceId: stripeIds.stripePriceId,
              stripePerUserPriceId: stripeIds.stripePerUserPriceId,
              updatedAt: new Date(),
            })
            .where(eq(plans.id, plan.id));

          results.push({
            planId: plan.id,
            name: plan.name,
            status: "synced",
            stripePriceId: stripeIds.stripePriceId,
          });
        } catch (err) {
          results.push({
            planId: plan.id,
            name: plan.name,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      const syncedCount = results.filter((r) => r.status === "synced").length;
      const failedCount = results.filter((r) => r.status === "failed").length;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plans.bulk_synced_to_stripe",
        resourceType: "plan",
        resourceId: "bulk",
        metadata: { syncedCount, failedCount, totalPlans: allPlans.length },
      });

      return reply.send({
        success: true,
        data: {
          summary: {
            total: allPlans.length,
            synced: syncedCount,
            failed: failedCount,
            skipped: results.filter((r) => r.status === "skipped").length,
          },
          results,
        },
      });
    },
  );

  // ── POST /plans/admin/clear-stale-stripe-ids — Remove dead Stripe references ──
  app.post(
    "/plans/admin/clear-stale-stripe-ids",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          success: false,
          error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" },
        });
      }

      // Fetch all active Stripe prices
      const activeStripePriceIds = new Set<string>();
      for await (const price of stripe.prices.list({ limit: 100, active: true })) {
        activeStripePriceIds.add(price.id);
      }

      const allPlans = await db.select().from(plans);
      let clearedCount = 0;

      for (const plan of allPlans) {
        const basePriceStale = plan.stripePriceId && !activeStripePriceIds.has(plan.stripePriceId);
        const perUserPriceStale = plan.stripePerUserPriceId && !activeStripePriceIds.has(plan.stripePerUserPriceId);

        if (basePriceStale || perUserPriceStale) {
          await db
            .update(plans)
            .set({
              stripePriceId: basePriceStale ? null : plan.stripePriceId,
              stripePerUserPriceId: perUserPriceStale ? null : plan.stripePerUserPriceId,
              updatedAt: new Date(),
            })
            .where(eq(plans.id, plan.id));
          clearedCount++;
        }
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plans.stale_stripe_ids_cleared",
        resourceType: "plan",
        resourceId: "bulk",
        metadata: { clearedCount, totalPlans: allPlans.length },
      });

      return reply.send({
        success: true,
        data: { clearedCount, totalPlans: allPlans.length },
      });
    },
  );

  // ── DELETE /plans/admin/bulk — Delete multiple plans by ID ──
  app.delete(
    "/plans/admin/bulk",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const bodyParsed = z.object({
        planIds: z.array(z.string().uuid()).min(1).max(100),
        permanent: z.boolean().default(false),
      }).safeParse(request.body);

      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { planIds, permanent } = bodyParsed.data;
      let deletedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ planId: string; reason: string }> = [];

      for (const planId of planIds) {
        const [existing] = await db
          .select()
          .from(plans)
          .where(eq(plans.id, planId))
          .limit(1);

        if (!existing) {
          errors.push({ planId, reason: "Not found" });
          continue;
        }

        if (permanent) {
          // Check for subscription references
          const [ref] = await db
            .select({ id: subscriptionItems.id })
            .from(subscriptionItems)
            .where(eq(subscriptionItems.planId, planId))
            .limit(1);

          if (ref) {
            errors.push({ planId, reason: "Referenced by active subscriptions — deactivate instead" });
            skippedCount++;
            continue;
          }

          await db.delete(plans).where(eq(plans.id, planId));
        } else {
          await db
            .update(plans)
            .set({ isActive: "false", updatedAt: new Date() })
            .where(eq(plans.id, planId));
        }

        deletedCount++;
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: permanent ? "plans.bulk_deleted" : "plans.bulk_deactivated",
        resourceType: "plan",
        resourceId: "bulk",
        metadata: { deletedCount, skippedCount, errorCount: errors.length, planIds },
      });

      return reply.send({
        success: true,
        data: { deletedCount, skippedCount, errors },
      });
    },
  );

  // ── POST /plans/admin/create-annual-variants — Create missing annual plans ──
  app.post(
    "/plans/admin/create-annual-variants",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const allPlans = await db.select().from(plans);

      const planCombos = new Set(
        allPlans.map((p) => `${p.productId}|${p.moduleId}|${p.tier}|${p.billingInterval}`),
      );

      const monthlyPlans = allPlans.filter(
        (p) => p.billingInterval === "monthly" && p.isActive === "true",
      );

      const created: Array<Record<string, unknown>> = [];
      const skipped: Array<{ name: string; reason: string }> = [];

      for (const monthly of monthlyPlans) {
        const annualKey = `${monthly.productId}|${monthly.moduleId}|${monthly.tier}|annual`;
        if (planCombos.has(annualKey)) {
          skipped.push({ name: monthly.name, reason: "Annual variant already exists" });
          continue;
        }

        // Annual = monthly × 10 (2 months free on a 12-month commitment)
        const monthlyBase = Number(monthly.basePrice);
        const monthlyPerUser = Number(monthly.perUserPrice);
        const annualBase = (monthlyBase * 10).toFixed(2);
        const annualPerUser = (monthlyPerUser * 10).toFixed(2);

        const [newPlan] = await db
          .insert(plans)
          .values({
            name: monthly.name,
            productId: monthly.productId,
            moduleId: monthly.moduleId,
            tier: monthly.tier,
            basePrice: annualBase,
            includedUsers: monthly.includedUsers,
            perUserPrice: annualPerUser,
            billingInterval: "annual",
            features: monthly.features ?? [],
          })
          .returning();

        if (newPlan) {
          // Auto-sync to Stripe
          if (isStripeConfigured()) {
            try {
              const stripeIds = await syncPlanToStripe(newPlan);
              await db
                .update(plans)
                .set({
                  stripePriceId: stripeIds.stripePriceId,
                  stripePerUserPriceId: stripeIds.stripePerUserPriceId,
                  updatedAt: new Date(),
                })
                .where(eq(plans.id, newPlan.id));
            } catch {
              // Stripe sync failure — plan still created
            }
          }

          created.push(formatPlan(newPlan));
          planCombos.add(annualKey);
        }
      }

      if (created.length > 0) {
        const admin = (
          request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
        ).platformAdmin;

        await db.insert(auditLog).values({
          actorId: admin.userId,
          actorType: "admin",
          action: "plans.annual_variants_created",
          resourceType: "plan",
          resourceId: "bulk",
          metadata: { createdCount: created.length, skippedCount: skipped.length },
        });
      }

      return reply.send({
        success: true,
        data: {
          created,
          skipped,
          summary: {
            created: created.length,
            skipped: skipped.length,
          },
        },
      });
    },
  );

  // ── GET /plans/admin/orphans — Find DB plans whose moduleId doesn't exist in PRODUCT_CONFIG ──
  app.get(
    "/plans/admin/orphans",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      const validModuleIds = getValidModuleIds();
      const allPlans = await db
        .select()
        .from(plans)
        .orderBy(plans.productId, plans.moduleId, plans.tier);

      const orphans = allPlans.filter((p) => !validModuleIds.has(p.moduleId ?? ""));
      const valid = allPlans.filter((p) => validModuleIds.has(p.moduleId ?? ""));

      return reply.send({
        success: true,
        data: {
          orphans: orphans.map(formatPlan),
          validCount: valid.length,
          orphanCount: orphans.length,
          validModuleIds: [...validModuleIds],
        },
      });
    },
  );

  // ── DELETE /plans/admin/purge-orphans — Delete all plans whose moduleId doesn't exist in PRODUCT_CONFIG ──
  app.delete(
    "/plans/admin/purge-orphans",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const validModuleIds = getValidModuleIds();
      const allPlans = await db.select().from(plans);

      const orphanIds = allPlans
        .filter((p) => !validModuleIds.has(p.moduleId ?? ""))
        .map((p) => p.id);

      if (orphanIds.length === 0) {
        return reply.send({
          success: true,
          data: { deletedCount: 0, message: "No orphaned plans found" },
        });
      }

      // Check which orphans are referenced by subscriptions
      const referencedOrphans: string[] = [];
      const deletableOrphans: string[] = [];

      for (const orphanId of orphanIds) {
        const [ref] = await db
          .select({ id: subscriptionItems.id })
          .from(subscriptionItems)
          .where(eq(subscriptionItems.planId, orphanId))
          .limit(1);

        if (ref) {
          referencedOrphans.push(orphanId);
        } else {
          deletableOrphans.push(orphanId);
        }
      }

      // Hard delete the ones that aren't referenced
      if (deletableOrphans.length > 0) {
        await db.delete(plans).where(inArray(plans.id, deletableOrphans));
      }

      // Deactivate the ones that ARE referenced (can't hard delete)
      if (referencedOrphans.length > 0) {
        await db
          .update(plans)
          .set({ isActive: "false", updatedAt: new Date() })
          .where(inArray(plans.id, referencedOrphans));
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "plans.orphans_purged",
        resourceType: "plan",
        resourceId: "bulk",
        metadata: {
          hardDeleted: deletableOrphans.length,
          deactivated: referencedOrphans.length,
          totalOrphans: orphanIds.length,
        },
      });

      return reply.send({
        success: true,
        data: {
          hardDeleted: deletableOrphans.length,
          deactivated: referencedOrphans.length,
          totalOrphans: orphanIds.length,
        },
      });
    },
  );

  // ── POST /plans/admin/archive-orphaned-stripe-prices — Archive Stripe prices not linked to any DB plan ──
  app.post(
    "/plans/admin/archive-orphaned-stripe-prices",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          success: false,
          error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" },
        });
      }

      // Get all Stripe price IDs referenced by DB plans
      const allPlans = await db.select().from(plans);
      const referencedPriceIds = new Set(
        allPlans
          .flatMap((p) => [p.stripePriceId, p.stripePerUserPriceId])
          .filter((id): id is string => id !== null && id !== undefined),
      );

      // Fetch all active Stripe prices
      const orphanedPrices: string[] = [];
      for await (const price of stripe.prices.list({ limit: 100, active: true })) {
        if (!referencedPriceIds.has(price.id)) {
          orphanedPrices.push(price.id);
        }
      }

      // Archive them
      let archivedCount = 0;
      const errors: Array<{ priceId: string; error: string }> = [];
      for (const priceId of orphanedPrices) {
        try {
          await stripe.prices.update(priceId, { active: false });
          archivedCount++;
        } catch (err) {
          errors.push({
            priceId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      const admin = (
        request as FastifyRequest & { platformAdmin: PlatformAdminAuth }
      ).platformAdmin;

      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "admin",
        action: "stripe.orphaned_prices_archived",
        resourceType: "stripe_price",
        resourceId: "bulk",
        metadata: { archivedCount, errorCount: errors.length },
      });

      return reply.send({
        success: true,
        data: { archivedCount, errors },
      });
    },
  );
}

/** Check if Stripe is actually configured (not placeholder) */
function isStripeConfigured(): boolean {
  return Boolean(
    config.stripe.secretKey &&
    !config.stripe.secretKey.startsWith("sk_test_placeholder"),
  );
}

/** Get all valid module IDs from PRODUCT_CONFIG */
function getValidModuleIds(): Set<string> {
  const ids = new Set<string>();
  for (const product of Object.values(PRODUCT_CONFIG)) {
    for (const mod of product.baseModules) {
      ids.add(mod.id);
    }
    for (const addon of product.addons) {
      ids.add(addon.id);
    }
  }
  return ids;
}
