import type { FastifyInstance } from "fastify";
import { eq, and, isNull, ilike, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { getSession } from "../middleware/auth.js";
import {
  createTenantSchema,
  updateTenantSchema,
  tenantListQuerySchema,
  tenantIdParamSchema,
} from "@opshield/shared/schemas";

function formatTenant(tenant: typeof tenants.$inferSelect): Record<string, unknown> {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    billingEmail: tenant.billingEmail,
    stripeCustomerId: tenant.stripeCustomerId,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /tenants — Create tenant (platform admin only) ──
  app.post(
    "/tenants",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = createTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.issues },
        });
      }

      const { name, slug, billingEmail } = parsed.data;

      // Check slug uniqueness
      const [existing] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: "CONFLICT", message: "A tenant with this slug already exists" },
        });
      }

      const [tenant] = await db
        .insert(tenants)
        .values({ name, slug, billingEmail })
        .returning();

      if (!tenant) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create tenant" },
        });
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "tenant.created",
        resourceType: "tenant",
        resourceId: tenant.id,
        metadata: { name, slug },
      });

      return reply.status(201).send({
        success: true,
        data: formatTenant(tenant),
      });
    },
  );

  // ── GET /tenants — List tenants (platform admin only) ──
  app.get(
    "/tenants",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = tenantListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
        });
      }

      const { page, limit, status, search } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [isNull(tenants.deletedAt)];
      if (status) {
        conditions.push(eq(tenants.status, status));
      }
      if (search) {
        conditions.push(ilike(tenants.name, `%${search}%`));
      }

      const whereClause = and(...conditions);

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(tenants)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(tenants.createdAt),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(tenants)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      return reply.send({
        success: true,
        data: {
          items: rows.map(formatTenant),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // ── GET /tenants/:tenantId — Get single tenant (platform admin only) ──
  app.get(
    "/tenants/:tenantId",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const parsed = tenantIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, parsed.data.tenantId), isNull(tenants.deletedAt)))
        .limit(1);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      return reply.send({
        success: true,
        data: formatTenant(tenant),
      });
    },
  );

  // ── PATCH /tenants/:tenantId — Update tenant (platform admin only) ──
  app.patch(
    "/tenants/:tenantId",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = updateTenantSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { tenantId } = paramParsed.data;
      const updates = bodyParsed.data;

      // Check tenant exists and not deleted
      const [existing] = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tenant not found" },
        });
      }

      const [updated] = await db
        .update(tenants)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to update tenant" },
        });
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "tenant.updated",
        resourceType: "tenant",
        resourceId: tenantId,
        metadata: updates,
      });

      return reply.send({
        success: true,
        data: formatTenant(updated),
      });
    },
  );
}
