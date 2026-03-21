import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { user } from "../db/schema/auth.js";
import { platformAdmins, auditLog } from "../db/schema/tenants.js";
import {
  requirePlatformAdmin,
  requireDeleteAccess,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";
import { ADMIN_ROLES } from "@opshield/shared/constants";

const validRoles = Object.values(ADMIN_ROLES);

const promoteAdminSchema = z.object({
  email: z.email(),
  role: z.enum(validRoles as [string, ...string[]]),
});

const updateAdminRoleSchema = z.object({
  role: z.enum(validRoles as [string, ...string[]]),
});

const adminIdParamSchema = z.object({
  adminId: z.uuid(),
});

export async function adminManagementRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /admin/platform-admins — List all platform admins (super_admin only) ──
  app.get(
    "/admin/platform-admins",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (_request, reply) => {
      const admins = await db
        .select({
          id: platformAdmins.id,
          userId: platformAdmins.userId,
          role: platformAdmins.role,
          createdAt: platformAdmins.createdAt,
          updatedAt: platformAdmins.updatedAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(platformAdmins)
        .innerJoin(user, eq(platformAdmins.userId, user.id));

      return reply.send({
        success: true,
        data: admins.map((a) => ({
          id: a.id,
          userId: a.userId,
          role: a.role,
          name: a.userName,
          email: a.userEmail,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── POST /admin/platform-admins — Promote a user to platform admin (super_admin only) ──
  app.post(
    "/admin/platform-admins",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const bodyParsed = promoteAdminSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { email, role } = bodyParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      // Find user by email
      const [targetUser] = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: `No user found with email "${email}". They must have an account first.` },
        });
      }

      // Check if already an admin
      const [existing] = await db
        .select({ id: platformAdmins.id })
        .from(platformAdmins)
        .where(eq(platformAdmins.userId, targetUser.id))
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: "CONFLICT", message: `${targetUser.email} is already a platform admin.` },
        });
      }

      const [newAdmin] = await db
        .insert(platformAdmins)
        .values({ userId: targetUser.id, role })
        .returning();

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "admin.promoted",
        resourceType: "platform_admin",
        resourceId: newAdmin?.id ?? targetUser.id,
        metadata: { email, role },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: newAdmin?.id,
          userId: targetUser.id,
          role,
          name: targetUser.name,
          email: targetUser.email,
        },
      });
    },
  );

  // ── PATCH /admin/platform-admins/:adminId — Update admin role (super_admin only) ──
  app.patch(
    "/admin/platform-admins/:adminId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramParsed = adminIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid admin ID" },
        });
      }

      const bodyParsed = updateAdminRoleSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { adminId } = paramParsed.data;
      const { role } = bodyParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      // Cannot change your own role
      if (adminId === actor.id) {
        return reply.status(400).send({
          success: false,
          error: { code: "SELF_MODIFY", message: "You cannot change your own role." },
        });
      }

      const [existing] = await db
        .select()
        .from(platformAdmins)
        .where(eq(platformAdmins.id, adminId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Admin not found" },
        });
      }

      await db
        .update(platformAdmins)
        .set({ role, updatedAt: new Date() })
        .where(eq(platformAdmins.id, adminId));

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "admin.role_changed",
        resourceType: "platform_admin",
        resourceId: adminId,
        metadata: { previousRole: existing.role, newRole: role },
      });

      return reply.send({ success: true, data: { id: adminId, role } });
    },
  );

  // ── DELETE /admin/platform-admins/:adminId — Remove platform admin (super_admin only) ──
  app.delete(
    "/admin/platform-admins/:adminId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramParsed = adminIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid admin ID" },
        });
      }

      const { adminId } = paramParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      // Cannot remove yourself
      if (adminId === actor.id) {
        return reply.status(400).send({
          success: false,
          error: { code: "SELF_MODIFY", message: "You cannot remove yourself as admin." },
        });
      }

      // Must always have at least one super_admin
      const superAdmins = await db
        .select({ id: platformAdmins.id })
        .from(platformAdmins)
        .where(eq(platformAdmins.role, "super_admin"));

      const [target] = await db
        .select()
        .from(platformAdmins)
        .where(eq(platformAdmins.id, adminId))
        .limit(1);

      if (!target) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Admin not found" },
        });
      }

      if (target.role === "super_admin" && superAdmins.length <= 1) {
        return reply.status(400).send({
          success: false,
          error: { code: "LAST_ADMIN", message: "Cannot remove the last super_admin." },
        });
      }

      await db.delete(platformAdmins).where(eq(platformAdmins.id, adminId));

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "admin.removed",
        resourceType: "platform_admin",
        resourceId: adminId,
        metadata: { removedUserId: target.userId, removedRole: target.role },
      });

      return reply.send({ success: true });
    },
  );
}
