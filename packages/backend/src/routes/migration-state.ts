import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  migrationState,
  migrationProducts,
  migrationLog,
  tenants,
} from "../db/schema/index.js";
import { requireServiceAuth } from "../middleware/require-service-auth.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { z } from "zod";

// ── Schemas ──

const migrationStateReportSchema = z.object({
  app: z.string().max(50),
  latestVersion: z.string().max(255),
  totalMigrations: z.number().int().min(0),
  tenants: z.array(
    z.object({
      tenantId: z.string(),
      schemaName: z.string().max(100),
      currentVersion: z.string().max(255).nullable(),
      appliedCount: z.number().int().min(0),
      status: z.enum(["current", "behind", "failed"]),
      error: z.string().optional(),
    }),
  ),
  reportedAt: z.string(),
});

export async function migrationStateRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ══════════════════════════════════════════════════
  // ── Receive Migration State Report (from products) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/migration-state",
    {
      preHandler: [requireServiceAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = migrationStateReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid migration state report",
            details: parsed.error.issues,
          },
        });
      }

      const report = parsed.data;

      // Update product-level info
      await db
        .insert(migrationProducts)
        .values({
          productId: report.app,
          latestVersion: report.latestVersion,
          totalMigrations: report.totalMigrations,
          lastReportedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: migrationProducts.productId,
          set: {
            latestVersion: report.latestVersion,
            totalMigrations: report.totalMigrations,
            lastReportedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      // Upsert per-tenant state
      for (const tenant of report.tenants) {
        const [existing] = await db
          .select()
          .from(migrationState)
          .where(
            and(
              eq(migrationState.productId, report.app),
              eq(migrationState.tenantId, tenant.tenantId),
            ),
          )
          .limit(1);

        if (existing) {
          await db
            .update(migrationState)
            .set({
              schemaName: tenant.schemaName,
              currentVersion: tenant.currentVersion,
              appliedCount: tenant.appliedCount,
              status: tenant.status,
              error: tenant.error ?? null,
              lastMigratedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(migrationState.id, existing.id));
        } else {
          await db.insert(migrationState).values({
            productId: report.app,
            tenantId: tenant.tenantId,
            schemaName: tenant.schemaName,
            currentVersion: tenant.currentVersion,
            appliedCount: tenant.appliedCount,
            status: tenant.status,
            error: tenant.error,
            lastMigratedAt: new Date(),
          });
        }
      }

      // Log the report
      await db.insert(migrationLog).values({
        productId: report.app,
        action: "state_reported",
        tenantsAffected: report.tenants.length,
        summary: {
          current: report.tenants.filter((t) => t.status === "current").length,
          behind: report.tenants.filter((t) => t.status === "behind").length,
          failed: report.tenants.filter((t) => t.status === "failed").length,
        },
      });

      return reply.send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Migration Dashboard Data (for admin UI) ──
  // ══════════════════════════════════════════════════

  app.get(
    "/migration-state",
    {
      preHandler: [requirePlatformAdmin],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Get product-level summary
      const products = await db
        .select()
        .from(migrationProducts)
        .orderBy(migrationProducts.productId);

      // Get per-tenant state with tenant names
      const states = await db
        .select({
          state: migrationState,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          tenantStatus: tenants.status,
        })
        .from(migrationState)
        .leftJoin(tenants, eq(migrationState.tenantId, tenants.id))
        .orderBy(migrationState.productId, migrationState.status);

      // Compute summary
      const summary = {
        nexum: { current: 0, behind: 0, failed: 0, total: 0 },
        safespec: { current: 0, behind: 0, failed: 0, total: 0 },
      };

      for (const row of states) {
        const product = row.state.productId as keyof typeof summary;
        if (summary[product]) {
          summary[product].total++;
          const status = row.state.status as "current" | "behind" | "failed";
          if (status in summary[product]) {
            summary[product][status]++;
          }
        }
      }

      return reply.send({
        success: true,
        data: {
          products,
          states,
          summary,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Migration Log (recent events) ──
  // ══════════════════════════════════════════════════

  app.get(
    "/migration-state/log",
    {
      preHandler: [requirePlatformAdmin],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = z
        .object({
          productId: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      const conditions = [];
      if (query.productId) {
        conditions.push(eq(migrationLog.productId, query.productId));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select()
        .from(migrationLog)
        .where(whereClause)
        .orderBy(desc(migrationLog.createdAt))
        .limit(query.limit);

      return reply.send({ success: true, data: logs });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Trigger Migration (admin sends webhook to product) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/migration-state/trigger",
    {
      preHandler: [requirePlatformAdmin],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = z
        .object({
          productId: z.enum(["nexum", "safespec"]),
          tenantId: z.string().uuid().optional(),
        })
        .parse(request.body);

      // Get product webhook URL from config
      const productUrls: Record<string, string> = {
        nexum:
          process.env["NEXUM_WEBHOOK_URL"] ??
          "http://localhost:3002/api/webhooks",
        safespec:
          process.env["SAFESPEC_WEBHOOK_URL"] ??
          "http://localhost:3001/api/webhooks",
      };

      const webhookUrl = productUrls[body.productId];
      if (!webhookUrl) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_PRODUCT",
            message: "Unknown product",
          },
        });
      }

      try {
        const payload = {
          event: "migration.trigger",
          tenantId: body.tenantId,
          triggeredAt: new Date().toISOString(),
        };

        const response = await fetch(
          webhookUrl.replace("/api/webhooks", "/api/webhooks/migrate"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
          },
        );

        const responseText = await response.text();

        // Log the trigger
        const admin = (
          request as FastifyRequest & {
            platformAdmin?: { userId: string };
          }
        ).platformAdmin;

        await db.insert(migrationLog).values({
          productId: body.productId,
          action: "migration_triggered",
          tenantsAffected: body.tenantId ? 1 : 0,
          summary: {
            tenantId: body.tenantId ?? "all",
            httpStatus: response.status,
            success: response.ok,
          },
          triggeredBy: admin?.userId,
        });

        if (!response.ok) {
          return reply.status(502).send({
            success: false,
            error: {
              code: "TRIGGER_FAILED",
              message: "Product returned error: ".concat(responseText),
            },
          });
        }

        return reply.send({
          success: true,
          data: { message: "Migration triggered", productId: body.productId },
        });
      } catch (err) {
        return reply.status(502).send({
          success: false,
          error: {
            code: "TRIGGER_FAILED",
            message:
              err instanceof Error ? err.message : "Failed to reach product",
          },
        });
      }
    },
  );
}
