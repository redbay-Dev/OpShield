import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { user } from "../db/schema/auth.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import { tenantUsers } from "../db/schema/tenant-users.js";
import {
  requirePlatformAdmin,
  requireWriteAccess,
  requireDeleteAccess,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";
import { tenantIdParamSchema } from "@opshield/shared/schemas";

const addTenantUserSchema = z.object({
  email: z.email(),
  role: z.string().min(1).max(50).default("member"),
});

const updateTenantUserSchema = z.object({
  role: z.string().min(1).max(50),
});

const tenantUserIdParamSchema = z.object({
  tenantId: z.uuid(),
  membershipId: z.uuid(),
});

export async function tenantUserRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /tenants/:tenantId/users — List all users for a tenant ──
  app.get(
    "/tenants/:tenantId/users",
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

      const members = await db
        .select({
          id: tenantUsers.id,
          userId: tenantUsers.userId,
          role: tenantUsers.role,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(tenantUsers)
        .innerJoin(user, eq(tenantUsers.userId, user.id))
        .where(eq(tenantUsers.tenantId, tenantId));

      return reply.send({
        success: true,
        data: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          name: m.userName,
          email: m.userEmail,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
      });
    },
  );

  // ── POST /tenants/:tenantId/users — Add user to tenant ──
  app.post(
    "/tenants/:tenantId/users",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramParsed = tenantIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
      }

      const bodyParsed = addTenantUserSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { tenantId } = paramParsed.data;
      const { email, role } = bodyParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

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

      // Check not already a member
      const [existing] = await db
        .select({ id: tenantUsers.id })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.userId, targetUser.id), eq(tenantUsers.tenantId, tenantId)))
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: "CONFLICT", message: `${email} is already a member of this tenant.` },
        });
      }

      const [membership] = await db
        .insert(tenantUsers)
        .values({ userId: targetUser.id, tenantId, role })
        .returning();

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "tenant_user.added",
        resourceType: "tenant_user",
        resourceId: membership?.id ?? targetUser.id,
        metadata: { tenantId, email, role },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: membership?.id,
          userId: targetUser.id,
          role,
          name: targetUser.name,
          email: targetUser.email,
        },
      });
    },
  );

  // ── PATCH /tenants/:tenantId/users/:membershipId — Update user role ──
  app.patch(
    "/tenants/:tenantId/users/:membershipId",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramParsed = tenantUserIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid parameters" },
        });
      }

      const bodyParsed = updateTenantUserSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: bodyParsed.error.issues },
        });
      }

      const { tenantId, membershipId } = paramParsed.data;
      const { role } = bodyParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [existing] = await db
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.id, membershipId), eq(tenantUsers.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Membership not found" },
        });
      }

      await db
        .update(tenantUsers)
        .set({ role, updatedAt: new Date() })
        .where(eq(tenantUsers.id, membershipId));

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "tenant_user.role_changed",
        resourceType: "tenant_user",
        resourceId: membershipId,
        metadata: { tenantId, previousRole: existing.role, newRole: role },
      });

      return reply.send({ success: true, data: { id: membershipId, role } });
    },
  );

  // ── DELETE /tenants/:tenantId/users/:membershipId — Remove user from tenant ──
  app.delete(
    "/tenants/:tenantId/users/:membershipId",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramParsed = tenantUserIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid parameters" },
        });
      }

      const { tenantId, membershipId } = paramParsed.data;
      const actor = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [existing] = await db
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.id, membershipId), eq(tenantUsers.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Membership not found" },
        });
      }

      await db.delete(tenantUsers).where(eq(tenantUsers.id, membershipId));

      await db.insert(auditLog).values({
        actorId: actor.userId,
        actorType: "platform_admin",
        action: "tenant_user.removed",
        resourceType: "tenant_user",
        resourceId: membershipId,
        metadata: { tenantId, removedUserId: existing.userId, removedRole: existing.role },
      });

      return reply.send({ success: true });
    },
  );
}
