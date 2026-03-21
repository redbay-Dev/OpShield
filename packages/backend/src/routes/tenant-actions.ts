import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db/client.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import { subscriptions } from "../db/schema/billing.js";
import {
  requirePlatformAdmin,
  type PlatformAdminAuth,
} from "../middleware/require-platform-admin.js";
import { requireWriteAccess, requireDeleteAccess } from "../middleware/require-platform-admin.js";
import { tenantIdParamSchema } from "@opshield/shared";
import { dispatchWebhook } from "../services/webhook.js";
import { sendAccountSuspendedEmail } from "../services/email.js";
import { config } from "../config.js";

const reasonSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const scheduleDeletionSchema = z.object({
  reason: z.string().min(1).max(1000),
  confirmSlug: z.string().min(1),
});

export async function tenantActionRoutes(app: FastifyInstance): Promise<void> {
  // ── Suspend Tenant ──
  app.post(
    "/tenants/:tenantId/suspend",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramResult = tenantIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
        return;
      }

      const bodyResult = reasonSchema.safeParse(request.body);
      if (!bodyResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Reason is required" },
        });
        return;
      }

      const { tenantId } = paramResult.data;
      const { reason } = bodyResult.data;
      const admin = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [tenant] = await db
        .select()
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

      if (tenant.status === "suspended") {
        void reply.status(409).send({
          success: false,
          error: { code: "ALREADY_SUSPENDED", message: "Tenant is already suspended" },
        });
        return;
      }

      await db
        .update(tenants)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "platform_admin",
        action: "tenant.suspended",
        resourceType: "tenant",
        resourceId: tenantId,
        metadata: { reason, previousStatus: tenant.status },
      });

      // Dispatch webhook to products
      void dispatchWebhook("tenant.suspended", tenantId, {
        tenantId,
        reason,
      });

      // Send email
      if (tenant.billingEmail) {
        void sendAccountSuspendedEmail({
          to: tenant.billingEmail,
          companyName: tenant.name,
          reactivateUrl: `${config.frontendUrl}/pricing`,
        }).catch(() => { /* non-blocking */ });
      }

      return { success: true, data: { status: "suspended" } };
    },
  );

  // ── Cancel Subscription ──
  app.post(
    "/tenants/:tenantId/cancel-subscription",
    { preHandler: [requirePlatformAdmin, requireWriteAccess] },
    async (request, reply) => {
      const paramResult = tenantIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
        return;
      }

      const bodyResult = reasonSchema.safeParse(request.body);
      if (!bodyResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Reason is required" },
        });
        return;
      }

      const { tenantId } = paramResult.data;
      const { reason } = bodyResult.data;
      const admin = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      if (!sub) {
        void reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "No subscription found for this tenant" },
        });
        return;
      }

      if (sub.cancelAtPeriodEnd) {
        void reply.status(409).send({
          success: false,
          error: { code: "ALREADY_CANCELLING", message: "Subscription is already set to cancel" },
        });
        return;
      }

      // Update local record
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "platform_admin",
        action: "subscription.cancel_scheduled",
        resourceType: "subscription",
        resourceId: sub.id,
        metadata: { reason, tenantId, stripeSubscriptionId: sub.stripeSubscriptionId },
      });

      return { success: true, data: { cancelAtPeriodEnd: true } };
    },
  );

  // ── Schedule Deletion ──
  app.post(
    "/tenants/:tenantId/schedule-deletion",
    { preHandler: [requirePlatformAdmin, requireDeleteAccess] },
    async (request, reply) => {
      const paramResult = tenantIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid tenant ID" },
        });
        return;
      }

      const bodyResult = scheduleDeletionSchema.safeParse(request.body);
      if (!bodyResult.success) {
        void reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Reason and confirmSlug are required", details: bodyResult.error.issues },
        });
        return;
      }

      const { tenantId } = paramResult.data;
      const { reason, confirmSlug } = bodyResult.data;
      const admin = (request as FastifyRequest & { platformAdmin: PlatformAdminAuth }).platformAdmin;

      const [tenant] = await db
        .select()
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

      if (confirmSlug !== tenant.slug) {
        void reply.status(400).send({
          success: false,
          error: { code: "SLUG_MISMATCH", message: "Confirmation slug does not match tenant slug" },
        });
        return;
      }

      // Set deletedAt to 90 days from now
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 90);

      await db
        .update(tenants)
        .set({
          status: "cancelled",
          deletedAt: deletionDate,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      // Audit log
      await db.insert(auditLog).values({
        actorId: admin.userId,
        actorType: "platform_admin",
        action: "tenant.deletion_scheduled",
        resourceType: "tenant",
        resourceId: tenantId,
        metadata: { reason, scheduledDeletionDate: deletionDate.toISOString() },
      });

      // Dispatch webhook
      void dispatchWebhook("tenant.cancelled", tenantId, {
        tenantId,
        reason,
        scheduledDeletionDate: deletionDate.toISOString(),
      });

      return {
        success: true,
        data: {
          status: "cancelled",
          scheduledDeletionDate: deletionDate.toISOString(),
        },
      };
    },
  );
}
