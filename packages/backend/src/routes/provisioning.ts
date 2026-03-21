import type { FastifyInstance, FastifyRequest } from "fastify";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import {
  requireServiceAuth,
  type ServiceKeyAuth,
} from "../middleware/require-service-auth.js";
import {
  tenantIdParamSchema,
  provisionTenantRequestSchema,
  provisioningCallbackSchema,
  retryProvisioningSchema,
} from "@opshield/shared/schemas";
import {
  provisionTenant,
  retryProvisioning,
  getProvisioningStatus,
  handleProvisioningCallback,
} from "../services/provisioning.js";

function formatProvisioningRow(
  row: { id: string; tenantId: string; productId: string; status: string; attempts: number; lastError: string | null; provisionedAt: Date | null; createdAt: Date; updatedAt: Date },
): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    provisionedAt: row.provisionedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function provisioningRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /tenants/:tenantId/provision — Trigger provisioning (platform admin) ──
  app.post(
    "/tenants/:tenantId/provision",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = provisionTenantRequestSchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      try {
        const results = await provisionTenant(paramParsed.data.tenantId, bodyParsed.data);
        return reply.status(200).send({
          success: true,
          data: { results },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Provisioning failed";
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message },
        });
      }
    },
  );

  // ── GET /tenants/:tenantId/provisioning-status — Check status (platform admin) ──
  app.get(
    "/tenants/:tenantId/provisioning-status",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const rows = await getProvisioningStatus(paramParsed.data.tenantId);
      return reply.send({
        success: true,
        data: rows.map(formatProvisioningRow),
      });
    },
  );

  // ── POST /tenants/:tenantId/retry-provisioning — Retry failed product (platform admin) ──
  app.post(
    "/tenants/:tenantId/retry-provisioning",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = retryProvisioningSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      try {
        const result = await retryProvisioning(
          paramParsed.data.tenantId,
          bodyParsed.data.productId,
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Retry failed";
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message },
        });
      }
    },
  );

  // ── POST /tenants/:tenantId/provisioning-callback — Product reports result (service key) ──
  app.post(
    "/tenants/:tenantId/provisioning-callback",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = provisioningCallbackSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { productId, success, error } = bodyParsed.data;

      // Verify service key product matches callback product
      const serviceKey = (
        request as FastifyRequest & { serviceKey?: ServiceKeyAuth }
      ).serviceKey;

      if (serviceKey && serviceKey.productId !== productId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Service key product does not match callback product",
          },
        });
      }

      try {
        await handleProvisioningCallback(
          paramParsed.data.tenantId,
          productId,
          success,
          error,
          serviceKey ? `service:${serviceKey.productId}` : undefined,
        );
        return reply.status(200).send({ success: true, data: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Callback processing failed";
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message },
        });
      }
    },
  );
}
