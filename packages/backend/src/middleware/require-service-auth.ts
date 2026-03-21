import type { FastifyReply, FastifyRequest } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins, serviceApiKeys } from "../db/schema/tenants.js";
import { getSession } from "./auth.js";
import type { PlatformAdminAuth } from "./require-platform-admin.js";
import type { AdminRole } from "@opshield/shared/constants";

/** Shape attached to request when authenticated via service API key */
export interface ServiceKeyAuth {
  productId: string;
  keyId: string;
}

/**
 * Guard that accepts EITHER:
 * 1. A valid `x-product-api-key` header (for product backends), OR
 * 2. A platform admin session (for browser-based admin access)
 *
 * On success, attaches either `serviceKey` or `platformAdmin` to the request.
 */
export async function requireServiceAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers["x-product-api-key"];

  if (typeof apiKey === "string" && apiKey.length > 0) {
    return authenticateWithApiKey(apiKey, request, reply);
  }

  // Fall back to platform admin session
  return authenticateWithSession(request, reply);
}

async function authenticateWithApiKey(
  apiKey: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const hash = createHash("sha256").update(apiKey).digest("hex");

  const [key] = await db
    .select()
    .from(serviceApiKeys)
    .where(
      and(
        eq(serviceApiKeys.keyHash, hash),
        eq(serviceApiKeys.status, "active"),
      ),
    )
    .limit(1);

  if (!key) {
    void reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" },
    });
    return;
  }

  // Constant-time comparison as a defence-in-depth measure
  const storedBuffer = Buffer.from(key.keyHash, "hex");
  const computedBuffer = Buffer.from(hash, "hex");
  if (!timingSafeEqual(storedBuffer, computedBuffer)) {
    void reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" },
    });
    return;
  }

  // Update last_used_at (fire-and-forget, don't block the request)
  void db
    .update(serviceApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(serviceApiKeys.id, key.id));

  const serviceKey: ServiceKeyAuth = {
    productId: key.productId,
    keyId: key.id,
  };
  (request as FastifyRequest & { serviceKey: ServiceKeyAuth }).serviceKey =
    serviceKey;
}

async function authenticateWithSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const session = await getSession(request);

  if (!session) {
    void reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, session.user.id))
    .limit(1);

  if (!admin) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Platform admin access required" },
    });
    return;
  }

  const platformAdmin: PlatformAdminAuth = {
    id: admin.id,
    userId: admin.userId,
    role: admin.role as AdminRole,
  };
  (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin =
    platformAdmin;
}
