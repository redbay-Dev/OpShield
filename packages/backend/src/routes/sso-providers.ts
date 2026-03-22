import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantSsoProviders, auditLog } from "../db/schema/tenants.js";
import { requirePlatformAdmin, requireWriteAccess, requireDeleteAccess } from "../middleware/require-platform-admin.js";
import { getSession } from "../middleware/auth.js";
import {
  tenantIdParamSchema,
  upsertSsoProviderSchema,
} from "@opshield/shared/schemas";

function formatProvider(
  row: typeof tenantSsoProviders.$inferSelect,
): Record<string, unknown> {
  const meta = row.metadata as Record<string, unknown> | null;
  const domains = Array.isArray(meta?.domains) ? (meta.domains as string[]) : [];
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    clientId: row.clientId,
    tenantIdAzure: row.tenantIdAzure,
    enforced: row.enforced,
    domains,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ssoProviderRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /tenants/:tenantId/sso-providers — List SSO providers for tenant ──
  app.get(
    "/tenants/:tenantId/sso-providers",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const providers = await db
        .select()
        .from(tenantSsoProviders)
        .where(eq(tenantSsoProviders.tenantId, paramParsed.data.tenantId));

      return reply.send({
        success: true,
        data: providers.map(formatProvider),
      });
    },
  );

  // ── PUT /tenants/:tenantId/sso-providers — Create or update SSO provider ──
  app.put(
    "/tenants/:tenantId/sso-providers",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = upsertSsoProviderSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { tenantId } = paramParsed.data;
      const { provider, clientId, clientSecret, tenantIdAzure, enforced, domains } = bodyParsed.data;

      // Verify tenant exists
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

      // Upsert: check if provider already exists for this tenant
      const [existing] = await db
        .select()
        .from(tenantSsoProviders)
        .where(
          and(
            eq(tenantSsoProviders.tenantId, tenantId),
            eq(tenantSsoProviders.provider, provider),
          ),
        )
        .limit(1);

      let result: typeof tenantSsoProviders.$inferSelect;

      if (existing) {
        const [updated] = await db
          .update(tenantSsoProviders)
          .set({
            clientId,
            clientSecret,
            tenantIdAzure,
            enforced,
            metadata: { domains },
            updatedAt: new Date(),
          })
          .where(eq(tenantSsoProviders.id, existing.id))
          .returning();
        result = updated!;
      } else {
        const [created] = await db
          .insert(tenantSsoProviders)
          .values({
            tenantId,
            provider,
            clientId,
            clientSecret,
            tenantIdAzure,
            enforced,
            metadata: { domains },
          })
          .returning();
        result = created!;
      }

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: existing ? "sso_provider.updated" : "sso_provider.created",
        resourceType: "tenant_sso_provider",
        resourceId: result.id,
        metadata: { tenantId, provider, enforced },
      });

      return reply.status(existing ? 200 : 201).send({
        success: true,
        data: formatProvider(result),
      });
    },
  );

  // ── DELETE /tenants/:tenantId/sso-providers/:providerId — Remove SSO provider ──
  app.delete(
    "/tenants/:tenantId/sso-providers/:providerId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const { tenantId, providerId } = request.params as { tenantId: string; providerId: string };

      const [existing] = await db
        .select()
        .from(tenantSsoProviders)
        .where(
          and(
            eq(tenantSsoProviders.id, providerId),
            eq(tenantSsoProviders.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "SSO provider not found" },
        });
      }

      await db.delete(tenantSsoProviders).where(eq(tenantSsoProviders.id, providerId));

      // Audit log
      const session = await getSession(request);
      await db.insert(auditLog).values({
        actorId: session?.user.id ?? "system",
        actorType: "platform_admin",
        action: "sso_provider.deleted",
        resourceType: "tenant_sso_provider",
        resourceId: providerId,
        metadata: { tenantId, provider: existing.provider },
      });

      return reply.send({ success: true });
    },
  );

  // ── GET /sso/discover — Domain-based SSO routing ──
  // Given an email domain, check if any tenant has SSO enforced for that domain
  app.get(
    "/sso/discover",
    async (request, reply) => {
      const { email } = request.query as { email?: string };
      if (!email || !email.includes("@")) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Valid email required" },
        });
      }

      const domain = email.split("@")[1]!.toLowerCase();

      // Check if any tenant has SSO with this Azure tenant domain
      // In a full implementation, tenant_sso_providers would have a `domains` column
      // For now, we check the metadata field for domain configuration
      const providers = await db
        .select({
          tenantId: tenantSsoProviders.tenantId,
          provider: tenantSsoProviders.provider,
          tenantIdAzure: tenantSsoProviders.tenantIdAzure,
          enforced: tenantSsoProviders.enforced,
          metadata: tenantSsoProviders.metadata,
        })
        .from(tenantSsoProviders)
        .where(eq(tenantSsoProviders.enforced, true));

      // Find a provider whose metadata.domains includes this domain
      const match = providers.find((p) => {
        const meta = p.metadata as Record<string, unknown> | null;
        if (!meta) return false;
        const domains = meta.domains;
        if (Array.isArray(domains)) {
          return domains.some((d) => typeof d === "string" && d.toLowerCase() === domain);
        }
        return false;
      });

      if (match) {
        return reply.send({
          success: true,
          data: {
            ssoRequired: true,
            provider: match.provider,
            tenantIdAzure: match.tenantIdAzure,
          },
        });
      }

      return reply.send({
        success: true,
        data: { ssoRequired: false },
      });
    },
  );
}
