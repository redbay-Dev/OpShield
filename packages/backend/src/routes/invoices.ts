import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { invoices } from "../db/schema/billing.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { tenantIdParamSchema } from "@opshield/shared/schemas";

function formatInvoice(
  inv: typeof invoices.$inferSelect,
): Record<string, unknown> {
  return {
    id: inv.id,
    stripeInvoiceId: inv.stripeInvoiceId,
    status: inv.status,
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    currency: inv.currency,
    invoiceUrl: inv.invoiceUrl,
    pdfUrl: inv.pdfUrl,
    periodStart: inv.periodStart?.toISOString() ?? null,
    periodEnd: inv.periodEnd?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
  };
}

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /tenants/:tenantId/invoices — List invoices for a tenant ──
  app.get(
    "/tenants/:tenantId/invoices",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const { tenantId } = paramParsed.data;

      const results = await db
        .select()
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .orderBy(desc(invoices.createdAt));

      return reply.send({
        success: true,
        data: results.map(formatInvoice),
      });
    },
  );
}
