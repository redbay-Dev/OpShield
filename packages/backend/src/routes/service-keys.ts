import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { serviceApiKeys } from "../db/schema/tenants.js";
import { requirePlatformAdmin, requireWriteAccess, requireDeleteAccess } from "../middleware/require-platform-admin.js";
import { createServiceKeySchema } from "@opshield/shared/schemas";

interface AdminRequest extends FastifyRequest {
  platformAdmin: { id: string; userId: string; role: string };
}

export async function serviceKeyRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /service-keys ──
  // Generate a new service API key for a product. Returns the raw key ONCE.
  app.post(
    "/service-keys",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const parsed = createServiceKeySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid product ID" },
        });
      }

      const { productId } = parsed.data;
      const adminRequest = request as AdminRequest;

      // Generate a 32-byte random key, hex-encoded (64 chars)
      const rawKey = randomBytes(32).toString("hex");
      const keyPrefix = rawKey.slice(0, 8);
      const keyHash = createHash("sha256").update(rawKey).digest("hex");

      const rows = await db
        .insert(serviceApiKeys)
        .values({
          productId,
          keyPrefix,
          keyHash,
          createdBy: adminRequest.platformAdmin.userId,
        })
        .returning();

      const created = rows[0];
      if (!created) {
        return reply.status(500).send({
          success: false,
          error: { code: "INSERT_FAILED", message: "Failed to create key" },
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: created.id,
          productId: created.productId,
          keyPrefix: created.keyPrefix,
          status: created.status,
          rawKey,
          createdAt: created.createdAt.toISOString(),
        },
      });
    },
  );

  // ── GET /service-keys ──
  // List all service API keys (never exposes raw key or hash).
  app.get(
    "/service-keys",
    { preHandler: [requirePlatformAdmin] },
    async (_request, reply) => {
      const keys = await db
        .select({
          id: serviceApiKeys.id,
          productId: serviceApiKeys.productId,
          keyPrefix: serviceApiKeys.keyPrefix,
          status: serviceApiKeys.status,
          createdBy: serviceApiKeys.createdBy,
          lastUsedAt: serviceApiKeys.lastUsedAt,
          revokedAt: serviceApiKeys.revokedAt,
          createdAt: serviceApiKeys.createdAt,
        })
        .from(serviceApiKeys);

      return reply.send({
        success: true,
        data: keys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        })),
      });
    },
  );

  // ── DELETE /service-keys/:keyId ──
  // Revoke a service API key (super_admin only).
  app.delete(
    "/service-keys/:keyId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const { keyId } = request.params as { keyId: string };

      const [key] = await db
        .select()
        .from(serviceApiKeys)
        .where(eq(serviceApiKeys.id, keyId))
        .limit(1);

      if (!key) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Service key not found" },
        });
      }

      if (key.status === "revoked") {
        return reply.status(409).send({
          success: false,
          error: { code: "ALREADY_REVOKED", message: "Key is already revoked" },
        });
      }

      await db
        .update(serviceApiKeys)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(eq(serviceApiKeys.id, keyId));

      return reply.send({
        success: true,
        data: { id: keyId, status: "revoked" },
      });
    },
  );
}
