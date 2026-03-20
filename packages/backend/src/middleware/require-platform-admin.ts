import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins } from "../db/schema/tenants.js";
import { getSession } from "./auth.js";

/**
 * Guard that requires the caller to be an authenticated platform admin.
 * Use as a Fastify preHandler hook on admin-only routes.
 */
export async function requirePlatformAdmin(
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

  // Attach to request for downstream use
  (request as FastifyRequest & { platformAdmin: typeof admin }).platformAdmin = admin;
}
