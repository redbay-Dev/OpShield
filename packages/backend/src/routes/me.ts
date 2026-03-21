import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins } from "../db/schema/tenants.js";
import { notificationPreferences } from "../db/schema/notification-preferences.js";
import { getSession } from "../middleware/auth.js";
import { requireAuth, type AuthenticatedUser } from "../middleware/require-auth.js";
import { updateNotificationPreferencesSchema } from "@opshield/shared";
import { dispatchSessionRevokedWebhook } from "../services/webhook.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/admin-status", async (request, reply) => {
    const session = await getSession(request);

    if (!session) {
      void reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const [admin] = await db
      .select({ userId: platformAdmins.userId, role: platformAdmins.role })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, session.user.id))
      .limit(1);

    return {
      success: true,
      data: {
        isPlatformAdmin: Boolean(admin),
        role: admin?.role ?? null,
      },
    };
  });

  // ── Global Logout ──

  app.post(
    "/me/logout-everywhere",
    { preHandler: [requireAuth] },
    async (request) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      // Dispatch session.revoked webhook to all products
      dispatchSessionRevokedWebhook(userId);

      return {
        success: true,
        data: { loggedOut: true },
      };
    },
  );

  // ── Notification Preferences ──

  app.get(
    "/me/notification-preferences",
    { preHandler: [requireAuth] },
    async (request) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      const [prefs] = await db
        .select({
          billingEmails: notificationPreferences.billingEmails,
          supportEmails: notificationPreferences.supportEmails,
          productUpdates: notificationPreferences.productUpdates,
        })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      // Return defaults if no row exists yet
      return {
        success: true,
        data: prefs ?? {
          billingEmails: true,
          supportEmails: true,
          productUpdates: true,
        },
      };
    },
  );

  app.patch(
    "/me/notification-preferences",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      const parseResult = updateNotificationPreferencesSchema.safeParse(request.body);
      if (!parseResult.success) {
        void reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid notification preferences",
            details: parseResult.error.issues,
          },
        });
        return;
      }

      const input = parseResult.data;

      // Upsert: create if not exists, update if exists
      const [existing] = await db
        .select({ id: notificationPreferences.id })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (existing) {
        await db
          .update(notificationPreferences)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(notificationPreferences.userId, userId));
      } else {
        await db.insert(notificationPreferences).values({
          userId,
          billingEmails: input.billingEmails ?? true,
          supportEmails: input.supportEmails ?? true,
          productUpdates: input.productUpdates ?? true,
        });
      }

      // Re-read to return the updated state
      const [updated] = await db
        .select({
          billingEmails: notificationPreferences.billingEmails,
          supportEmails: notificationPreferences.supportEmails,
          productUpdates: notificationPreferences.productUpdates,
        })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      return {
        success: true,
        data: updated,
      };
    },
  );
}
