import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantModules, auditLog } from "../db/schema/tenants.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { getSession } from "../middleware/auth.js";
import {
  addModuleSchema,
  updateModuleSchema,
  moduleIdParamSchema,
  tenantIdParamSchema,
} from "@opshield/shared/schemas";
import { SAFESPEC_MODULES, NEXUM_MODULES } from "@opshield/shared/constants";
import { dispatchWebhook } from "../services/webhook.js";

/** All valid module IDs by product */
const VALID_MODULES: Record<string, ReadonlySet<string>> = {
  safespec: new Set(Object.values(SAFESPEC_MODULES)),
  nexum: new Set(Object.values(NEXUM_MODULES)),
};

function formatModule(
  mod: typeof tenantModules.$inferSelect,
): Record<string, unknown> {
  return {
    id: mod.id,
    tenantId: mod.tenantId,
    productId: mod.productId,
    moduleId: mod.moduleId,
    status: mod.status,
    maxUsers: mod.maxUsers,
    currentUsers: mod.currentUsers,
    createdAt: mod.createdAt.toISOString(),
    updatedAt: mod.updatedAt.toISOString(),
  };
}

export async function moduleRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /tenants/:tenantId/modules — Add module to tenant ──
  app.post(
    "/tenants/:tenantId/modules",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = addModuleSchema.safeParse(request.body);
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
      const { productId, moduleId, maxUsers, status } = bodyParsed.data;

      // Validate moduleId belongs to productId
      const validModules = VALID_MODULES[productId];
      if (!validModules?.has(moduleId)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_MODULE",
            message: `Module "${moduleId}" is not valid for product "${productId}"`,
          },
        });
      }

      // Check tenant exists
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      // Check module not already assigned
      const [existing] = await db
        .select({ id: tenantModules.id })
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.moduleId, moduleId),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "CONFLICT",
            message: `Module "${moduleId}" is already assigned to this tenant`,
          },
        });
      }

      // Nexum compliance requires SafeSpec subscription
      if (moduleId === "nexum-compliance") {
        const [safespecModule] = await db
          .select({ id: tenantModules.id })
          .from(tenantModules)
          .where(
            and(
              eq(tenantModules.tenantId, tenantId),
              eq(tenantModules.productId, "safespec"),
              eq(tenantModules.status, "active"),
            ),
          )
          .limit(1);

        if (!safespecModule) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "DEPENDENCY_MISSING",
              message:
                "Nexum Compliance module requires an active SafeSpec subscription (WHS or HVA)",
            },
          });
        }
      }

      const [mod] = await db
        .insert(tenantModules)
        .values({ tenantId, productId, moduleId, maxUsers, status })
        .returning();

      if (!mod) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to add module" },
        });
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "module.added",
        resourceType: "tenant_module",
        resourceId: mod.id,
        metadata: { tenantId, productId, moduleId, maxUsers, status },
      });

      dispatchWebhook("module.activated", tenantId, {
        productId,
        moduleId,
        maxUsers,
        status,
      });

      return reply.status(201).send({
        success: true,
        data: formatModule(mod),
      });
    },
  );

  // ── PATCH /tenants/:tenantId/modules/:moduleId — Update module ──
  app.patch(
    "/tenants/:tenantId/modules/:moduleId",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = moduleIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid parameters" },
        });
      }

      const bodyParsed = updateModuleSchema.safeParse(request.body);
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

      const { tenantId, moduleId } = paramParsed.data;
      const updates = bodyParsed.data;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "No updates provided" },
        });
      }

      const [existing] = await db
        .select()
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.moduleId, moduleId),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Module not found on tenant" },
        });
      }

      const [updated] = await db
        .update(tenantModules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(tenantModules.id, existing.id))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update module",
          },
        });
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "module.updated",
        resourceType: "tenant_module",
        resourceId: updated.id,
        metadata: { tenantId, moduleId, updates },
      });

      // Dispatch webhook based on status transition
      if (updates.status && updates.status !== existing.status) {
        const eventMap: Record<string, "module.suspended" | "module.cancelled" | "module.activated"> = {
          suspended: "module.suspended",
          cancelled: "module.cancelled",
          active: "module.activated",
          trial: "module.activated",
        };
        const event = eventMap[updates.status];
        if (event) {
          dispatchWebhook(event, tenantId, {
            productId: existing.productId,
            moduleId,
            previousStatus: existing.status,
            newStatus: updates.status,
          });
        }
      }

      return reply.send({
        success: true,
        data: formatModule(updated),
      });
    },
  );

  // ── DELETE /tenants/:tenantId/modules/:moduleId — Remove module ──
  app.delete(
    "/tenants/:tenantId/modules/:moduleId",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = moduleIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid parameters" },
        });
      }

      const { tenantId, moduleId } = paramParsed.data;

      const [existing] = await db
        .select()
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.tenantId, tenantId),
            eq(tenantModules.moduleId, moduleId),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Module not found on tenant" },
        });
      }

      // If removing a SafeSpec module, check if Nexum compliance depends on it
      if (existing.productId === "safespec") {
        const [complianceModule] = await db
          .select({ id: tenantModules.id })
          .from(tenantModules)
          .where(
            and(
              eq(tenantModules.tenantId, tenantId),
              eq(tenantModules.moduleId, "nexum-compliance"),
              eq(tenantModules.status, "active"),
            ),
          )
          .limit(1);

        // Only block if this is the last active SafeSpec module
        if (complianceModule) {
          const otherSafespec = await db
            .select({ id: tenantModules.id })
            .from(tenantModules)
            .where(
              and(
                eq(tenantModules.tenantId, tenantId),
                eq(tenantModules.productId, "safespec"),
                eq(tenantModules.status, "active"),
              ),
            );

          // If only 1 active SafeSpec module (the one being removed), block
          if (otherSafespec.length <= 1) {
            return reply.status(400).send({
              success: false,
              error: {
                code: "DEPENDENCY_CONFLICT",
                message:
                  "Cannot remove last SafeSpec module while Nexum Compliance is active. Remove Nexum Compliance first.",
              },
            });
          }
        }
      }

      await db
        .delete(tenantModules)
        .where(eq(tenantModules.id, existing.id));

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "module.removed",
        resourceType: "tenant_module",
        resourceId: existing.id,
        metadata: {
          tenantId,
          productId: existing.productId,
          moduleId,
        },
      });

      dispatchWebhook("module.cancelled", tenantId, {
        productId: existing.productId,
        moduleId,
      });

      return reply.send({ success: true });
    },
  );
}
