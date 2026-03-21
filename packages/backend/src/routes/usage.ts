import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenantModules } from "../db/schema/tenants.js";
import { tenantUsage } from "../db/schema/billing.js";
import {
  requireServiceAuth,
  type ServiceKeyAuth,
} from "../middleware/require-service-auth.js";
import { usageReportSchema } from "@opshield/shared/schemas";
import { dispatchWebhookToProduct } from "../services/webhook.js";

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
        .select({ id: tenantModules.id })
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

      // Fire webhook back to reporting product
      dispatchWebhookToProduct(productId, "user_count.updated", tenantId, {
        moduleId,
        userCount: value,
      });

      return reply.status(201).send({
        success: true,
        data: { tenantId, productId, moduleId, metric, value },
      });
    },
  );
}
