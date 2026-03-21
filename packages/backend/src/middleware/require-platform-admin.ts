import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins } from "../db/schema/tenants.js";
import { getSession } from "./auth.js";
import { ADMIN_ROLE_PERMISSIONS, type AdminRole } from "@opshield/shared/constants";

/** Shape attached to request when authenticated as platform admin */
export interface PlatformAdminAuth {
  id: string;
  userId: string;
  role: AdminRole;
}

/**
 * Guard that requires the caller to be an authenticated platform admin.
 * Use as a Fastify preHandler hook on admin-only routes.
 * All three roles (super_admin, support, viewer) pass this guard.
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

  // Validate role is a known value
  const role = admin.role as AdminRole;
  if (!(role in ADMIN_ROLE_PERMISSIONS)) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Invalid admin role" },
    });
    return;
  }

  // Attach to request for downstream use
  (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin = {
    id: admin.id,
    userId: admin.userId,
    role,
  };
}

/**
 * Guard that requires the admin to have write permissions (super_admin or support).
 * Must be used AFTER requirePlatformAdmin in the preHandler chain.
 */
export async function requireWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const admin = (request as FastifyRequest & { platformAdmin?: PlatformAdminAuth }).platformAdmin;
  if (!admin) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Platform admin access required" },
    });
    return;
  }

  const perms = ADMIN_ROLE_PERMISSIONS[admin.role];
  if (!perms.create && !perms.update) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Write access required. Viewer role is read-only." },
    });
    return;
  }
}

/**
 * Guard that requires delete permissions (super_admin only).
 * Must be used AFTER requirePlatformAdmin in the preHandler chain.
 */
export async function requireDeleteAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const admin = (request as FastifyRequest & { platformAdmin?: PlatformAdminAuth }).platformAdmin;
  if (!admin) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Platform admin access required" },
    });
    return;
  }

  const perms = ADMIN_ROLE_PERMISSIONS[admin.role];
  if (!perms.delete) {
    void reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Delete access requires super_admin role." },
    });
    return;
  }
}
