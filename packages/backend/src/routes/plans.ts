import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { plans } from "../db/schema/billing.js";
import { auditLog } from "../db/schema/tenants.js";
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
  // ── GET /plans — List all plans (admin) ──
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
}
