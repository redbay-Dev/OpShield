import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import { impersonationTokens } from "../db/schema/impersonation.js";
import {
  requirePlatformAdmin,
  requireWriteAccess,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";
import { requireServiceAuth } from "../middleware/require-service-auth.js";
import { config } from "../config.js";

const startImpersonationSchema = z.object({
  tenantId: z.string().uuid(),
  product: z.enum(["safespec", "nexum"]),
  reason: z.string().min(1).max(1000),
});

const endImpersonationSchema = z.object({
  token: z.string().min(1),
});

const validateTokenQuerySchema = z.object({
  token: z.string().min(1),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function impersonationRoutes(app: FastifyInstance): Promise<void> {
  // ── Start Impersonation ──
  app.post(
    "/impersonate",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const bodyResult = startImpersonationSchema.safeParse(request.body);
      if (!bodyResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request", details: bodyResult.error.issues },
        });
        return;
      }

      const { tenantId, product, reason } = bodyResult.data;
      const admin = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      // Verify tenant exists
      const [tenant] = await db
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
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

      // Generate token
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await db.insert(impersonationTokens).values({
        tokenHash,
        adminUserId: admin.userId,
        tenantId,
        product,
        reason,
        expiresAt,
      });

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "platform_admin",
        action: "impersonation.started",
        resourceType: "tenant",
        resourceId: tenantId,
        metadata: { product, reason, expiresAt: expiresAt.toISOString() },
      });

      // Build redirect URL
      const productUrl = product === "nexum"
        ? config.productUrls.nexum
        : config.productUrls.safespec;
      const redirectUrl = `${productUrl}/auth/impersonate?token=${rawToken}&from=opshield`;

      return {
        success: true,
        data: {
          token: rawToken,
          redirectUrl,
          expiresAt: expiresAt.toISOString(),
          tenantName: tenant.name,
        },
      };
    },
  );

  // ── End Impersonation ──
  app.delete(
    "/impersonate",
    { preHandler: [requirePlatformAdmin] },
    async (request, reply) => {
      const bodyResult = endImpersonationSchema.safeParse(request.body);
      if (!bodyResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Token is required" },
        });
        return;
      }

      const tokenHash = hashToken(bodyResult.data.token);
      const admin = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [token] = await db
        .select()
        .from(impersonationTokens)
        .where(
          and(
            eq(impersonationTokens.tokenHash, tokenHash),
            isNull(impersonationTokens.revokedAt),
          ),
        )
        .limit(1);

      if (!token) {
        void reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Token not found or already revoked" },
        });
        return;
      }

      await db
        .update(impersonationTokens)
        .set({ revokedAt: new Date() })
        .where(eq(impersonationTokens.id, token.id));

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "platform_admin",
        action: "impersonation.ended",
        resourceType: "tenant",
        resourceId: token.tenantId,
        metadata: { product: token.product },
      });

      return { success: true, data: { revoked: true } };
    },
  );

  // ── Validate Impersonation Token (called by products) ──
  app.get(
    "/impersonate/validate",
    { preHandler: [requireServiceAuth] },
    async (request, reply) => {
      const queryResult = validateTokenQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Token query param required" },
        });
        return;
      }

      const tokenHash = hashToken(queryResult.data.token);

      const [token] = await db
        .select()
        .from(impersonationTokens)
        .where(
          and(
            eq(impersonationTokens.tokenHash, tokenHash),
            isNull(impersonationTokens.revokedAt),
          ),
        )
        .limit(1);

      if (!token) {
        void reply.status(404).send({
          success: false,
          error: { code: "INVALID_TOKEN", message: "Token not found or revoked" },
        });
        return;
      }

      if (token.expiresAt < new Date()) {
        void reply.status(410).send({
          success: false,
          error: { code: "TOKEN_EXPIRED", message: "Impersonation token has expired" },
        });
        return;
      }

      // Get tenant info
      const [tenant] = await db
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, token.tenantId))
        .limit(1);

      return {
        success: true,
        data: {
          tenantId: token.tenantId,
          tenantName: tenant?.name ?? null,
          tenantSlug: tenant?.slug ?? null,
          product: token.product,
          adminUserId: token.adminUserId,
          reason: token.reason,
          expiresAt: token.expiresAt.toISOString(),
        },
      };
    },
  );
}
