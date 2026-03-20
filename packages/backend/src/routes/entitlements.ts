import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantModules } from "../db/schema/tenants.js";
import { plans } from "../db/schema/billing.js";
import {
  requireServiceAuth,
  type ServiceKeyAuth,
} from "../middleware/require-service-auth.js";
import { tenantIdParamSchema } from "@opshield/shared/schemas";

export async function entitlementRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /tenants/:tenantId/entitlements ──
  // Returns tenant status + module list with plan info for product backends.
  // Phase 2: authenticated via platform admin or service API key.
  app.get(
    "/tenants/:tenantId/entitlements",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const parsed = tenantIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const { tenantId } = parsed.data;

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
        .limit(1);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      // Get all modules for this tenant
      const modules = await db
        .select({
          productId: tenantModules.productId,
          moduleId: tenantModules.moduleId,
          status: tenantModules.status,
          maxUsers: tenantModules.maxUsers,
          currentUsers: tenantModules.currentUsers,
        })
        .from(tenantModules)
        .where(eq(tenantModules.tenantId, tenantId));

      // Look up active plans for each module to include plan info
      const allPlans = await db
        .select({
          moduleId: plans.moduleId,
          tier: plans.tier,
          includedUsers: plans.includedUsers,
          basePrice: plans.basePrice,
          perUserPrice: plans.perUserPrice,
        })
        .from(plans)
        .where(eq(plans.isActive, "true"));

      // Build a lookup: moduleId -> plan tiers
      const planLookup = new Map<
        string,
        { tier: string; includedUsers: number; basePrice: string; perUserPrice: string }[]
      >();
      for (const plan of allPlans) {
        if (plan.moduleId) {
          const existing = planLookup.get(plan.moduleId) ?? [];
          existing.push({
            tier: plan.tier,
            includedUsers: plan.includedUsers,
            basePrice: plan.basePrice,
            perUserPrice: plan.perUserPrice,
          });
          planLookup.set(plan.moduleId, existing);
        }
      }

      // When called via service key, scope to the calling product's modules
      const serviceKey = (
        request as FastifyRequest & { serviceKey?: ServiceKeyAuth }
      ).serviceKey;
      const scopedModules = serviceKey
        ? modules.filter((m) => m.productId === serviceKey.productId)
        : modules;

      // Enrich modules with plan info
      const enrichedModules = scopedModules.map((mod) => {
        const modulePlans = planLookup.get(mod.moduleId);
        // Find the plan that matches the module's maxUsers (best match for tier)
        const matchedPlan = modulePlans?.find(
          (p) => p.includedUsers <= mod.maxUsers,
        );

        return {
          productId: mod.productId,
          moduleId: mod.moduleId,
          status: mod.status,
          maxUsers: mod.maxUsers,
          currentUsers: mod.currentUsers,
          plan: matchedPlan
            ? {
                tier: matchedPlan.tier,
                includedUsers: matchedPlan.includedUsers,
                basePrice: matchedPlan.basePrice,
                perUserPrice: matchedPlan.perUserPrice,
              }
            : null,
        };
      });

      return reply.send({
        success: true,
        data: {
          tenantId: tenant.id,
          tenantStatus: tenant.status,
          modules: enrichedModules,
        },
      });
    },
  );
}
