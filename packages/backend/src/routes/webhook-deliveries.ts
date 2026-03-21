import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { webhookDeliveries } from "../db/schema/billing.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { webhookDeliveryQuerySchema } from "@opshield/shared/schemas";

function formatDelivery(
  row: typeof webhookDeliveries.$inferSelect,
): Record<string, unknown> {
  return {
    id: row.id,
    productId: row.productId,
    eventType: row.eventType,
    tenantId: row.tenantId,
    httpStatus: row.httpStatus,
    error: row.error,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function webhookDeliveryRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /webhook-deliveries — List webhook deliveries (platform admin only) ──
  app.get(
    "/webhook-deliveries",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = webhookDeliveryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
        });
      }

      const { page, limit, tenantId, productId, eventType, status } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (tenantId) {
        conditions.push(eq(webhookDeliveries.tenantId, tenantId));
      }
      if (productId) {
        conditions.push(eq(webhookDeliveries.productId, productId));
      }
      if (eventType) {
        conditions.push(eq(webhookDeliveries.eventType, eventType));
      }
      if (status === "failed") {
        conditions.push(sql`${webhookDeliveries.error} IS NOT NULL`);
      }
      if (status === "success") {
        conditions.push(sql`${webhookDeliveries.error} IS NULL`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(webhookDeliveries)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(webhookDeliveries.createdAt)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(webhookDeliveries)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      return reply.send({
        success: true,
        data: {
          items: rows.map(formatDelivery),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );
}
