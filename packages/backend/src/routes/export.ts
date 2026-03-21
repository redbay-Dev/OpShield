import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { tenants, tenantModules, auditLog } from "../db/schema/tenants.js";
import { subscriptions, invoices } from "../db/schema/billing.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { tenantIdParamSchema } from "@opshield/shared";

const exportQuerySchema = z.object({
  type: z.enum(["summary", "billing", "audit"]),
  format: z.enum(["json", "csv"]).default("json"),
});

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/tenants/:tenantId/export",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramResult = tenantIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
        return;
      }

      const queryResult = exportQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid export params", details: queryResult.error.issues },
        });
        return;
      }

      const { tenantId } = paramResult.data;
      const { type, format } = queryResult.data;

      // Verify tenant exists
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
        .limit(1);

      if (!tenant) {
        void reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
        return;
      }

      if (type === "summary") {
        const modules = await db
          .select()
          .from(tenantModules)
          .where(eq(tenantModules.tenantId, tenantId));

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.tenantId, tenantId))
          .limit(1);

        const data = {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            billingEmail: tenant.billingEmail,
            stripeCustomerId: tenant.stripeCustomerId,
            createdAt: tenant.createdAt.toISOString(),
          },
          modules: modules.map((m) => ({
            productId: m.productId,
            moduleId: m.moduleId,
            status: m.status,
            maxUsers: m.maxUsers,
            currentUsers: m.currentUsers,
          })),
          subscription: sub
            ? {
                status: sub.status,
                stripeSubscriptionId: sub.stripeSubscriptionId,
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              }
            : null,
        };

        if (format === "csv") {
          const csv = [
            "field,value",
            `name,${tenant.name}`,
            `slug,${tenant.slug}`,
            `status,${tenant.status}`,
            `billingEmail,${tenant.billingEmail ?? ""}`,
            `createdAt,${tenant.createdAt.toISOString()}`,
            `moduleCount,${modules.length}`,
            `subscriptionStatus,${sub?.status ?? "none"}`,
          ].join("\n");

          void reply
            .header("Content-Type", "text/csv")
            .header("Content-Disposition", `attachment; filename="tenant-${tenant.slug}-summary.csv"`)
            .send(csv);
          return;
        }

        void reply
          .header("Content-Type", "application/json")
          .header("Content-Disposition", `attachment; filename="tenant-${tenant.slug}-summary.json"`)
          .send(JSON.stringify(data, null, 2));
        return;
      }

      if (type === "billing") {
        const invoiceRows = await db
          .select()
          .from(invoices)
          .where(eq(invoices.tenantId, tenantId));

        if (format === "csv") {
          const header = "date,stripe_invoice_id,status,amount_due,amount_paid,currency";
          const rows = invoiceRows.map((inv) =>
            `${inv.createdAt.toISOString()},${inv.stripeInvoiceId},${inv.status},${inv.amountDue},${inv.amountPaid},${inv.currency}`,
          );
          const csv = [header, ...rows].join("\n");

          void reply
            .header("Content-Type", "text/csv")
            .header("Content-Disposition", `attachment; filename="tenant-${tenant.slug}-billing.csv"`)
            .send(csv);
          return;
        }

        void reply
          .header("Content-Type", "application/json")
          .header("Content-Disposition", `attachment; filename="tenant-${tenant.slug}-billing.json"`)
          .send(JSON.stringify(invoiceRows, null, 2));
        return;
      }

      if (type === "audit") {
        const logs = await db
          .select()
          .from(auditLog)
          .where(eq(auditLog.resourceId, tenantId));

        void reply
          .header("Content-Type", "application/json")
          .header("Content-Disposition", `attachment; filename="tenant-${tenant.slug}-audit.json"`)
          .send(JSON.stringify(logs, null, 2));
        return;
      }
    },
  );
}
