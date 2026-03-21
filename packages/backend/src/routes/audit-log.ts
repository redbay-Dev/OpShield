import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditLog } from "../db/schema/tenants.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { auditLogQuerySchema } from "@opshield/shared/schemas";

function formatAuditEntry(entry: typeof auditLog.$inferSelect): Record<string, unknown> {
  return {
    id: entry.id,
    actorId: entry.actorId,
    actorType: entry.actorType,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /audit-log — List audit log entries (all admin roles can read) ──
  app.get(
    "/audit-log",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = auditLogQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
        });
      }

      const { page, limit, action, resourceType, actorId, resourceId, from, to } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (action) {
        conditions.push(eq(auditLog.action, action));
      }
      if (resourceType) {
        conditions.push(eq(auditLog.resourceType, resourceType));
      }
      if (actorId) {
        conditions.push(eq(auditLog.actorId, actorId));
      }
      if (resourceId) {
        conditions.push(eq(auditLog.resourceId, resourceId));
      }
      if (from) {
        conditions.push(gte(auditLog.createdAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte(auditLog.createdAt, new Date(to)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(auditLog)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(auditLog.createdAt)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLog)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      return reply.send({
        success: true,
        data: {
          items: rows.map(formatAuditEntry),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );
}
