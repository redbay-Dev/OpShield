import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantModules } from "../db/schema/tenants.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { tenantIdParamSchema } from "@opshield/shared/schemas";

export async function entitlementRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /tenants/:tenantId/entitlements ──
  // Returns tenant status + module list for product backends to consume.
  // Phase 2: authenticated via platform admin or service API key.
  app.get(
    "/tenants/:tenantId/entitlements",
    { preHandler: [requirePlatformAdmin] },
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

      return reply.send({
        success: true,
        data: {
          tenantId: tenant.id,
          tenantStatus: tenant.status,
          modules,
        },
      });
    },
  );
}
