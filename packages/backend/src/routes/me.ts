import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins, tenants, tenantModules } from "../db/schema/tenants.js";
import { tenantUsers } from "../db/schema/tenant-users.js";
import { subscriptions } from "../db/schema/billing.js";
import { notificationPreferences } from "../db/schema/notification-preferences.js";
import { user, twoFactor } from "../db/schema/auth.js";
import { getSession } from "../middleware/auth.js";
import { requireAuth, type AuthenticatedUser } from "../middleware/require-auth.js";
import { updateNotificationPreferencesSchema } from "@opshield/shared";
import { dispatchSessionRevokedWebhook } from "../services/webhook.js";
import { stripe } from "../services/stripe.js";
import { config } from "../config.js";

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

  // ── 2FA Status — Check if user has 2FA enabled ──

  app.get("/me/2fa-status", async (request, reply) => {
    const session = await getSession(request);

    if (!session) {
      void reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    // Check user flags
    const [userRow] = await db
      .select({
        mustChangePassword: user.mustChangePassword,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    // Check if a two_factor record exists (Better Auth stores 2FA state here,
    // not on the user.twoFactorEnabled column)
    const [tfRecord] = await db
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .where(eq(twoFactor.userId, session.user.id))
      .limit(1);

    return {
      success: true,
      data: {
        twoFactorEnabled: Boolean(tfRecord),
        mustChangePassword: userRow?.mustChangePassword === true,
      },
    };
  });

  // ── Force Password Change — Clear the flag after password update ──

  app.post(
    "/me/complete-setup",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      // Just clear the mustChangePassword flag
      // The actual password change is handled by Better Auth's change-password endpoint
      await db
        .update(user)
        .set({ mustChangePassword: false, updatedAt: new Date() })
        .where(eq(user.id, userId));

      return reply.send({ success: true, data: null });
    },
  );

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

  // ── My Tenants ──

  app.get(
    "/me/tenants",
    { preHandler: [requireAuth] },
    async (request) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      const memberships = await db
        .select({
          tenantId: tenantUsers.tenantId,
          role: tenantUsers.role,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          tenantStatus: tenants.status,
          tenantBillingEmail: tenants.billingEmail,
          tenantCreatedAt: tenants.createdAt,
        })
        .from(tenantUsers)
        .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
        .where(
          and(
            eq(tenantUsers.userId, userId),
            isNull(tenants.deletedAt),
          ),
        );

      // Enrich with modules and subscription status
      const enriched = await Promise.all(
        memberships.map(async (m) => {
          const modules = await db
            .select({
              productId: tenantModules.productId,
              moduleId: tenantModules.moduleId,
              status: tenantModules.status,
              maxUsers: tenantModules.maxUsers,
              currentUsers: tenantModules.currentUsers,
            })
            .from(tenantModules)
            .where(eq(tenantModules.tenantId, m.tenantId));

          const [sub] = await db
            .select({
              status: subscriptions.status,
              currentPeriodEnd: subscriptions.currentPeriodEnd,
              cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            })
            .from(subscriptions)
            .where(eq(subscriptions.tenantId, m.tenantId))
            .limit(1);

          return {
            tenantId: m.tenantId,
            role: m.role,
            name: m.tenantName,
            slug: m.tenantSlug,
            status: m.tenantStatus,
            billingEmail: m.tenantBillingEmail,
            createdAt: m.tenantCreatedAt.toISOString(),
            modules,
            subscription: sub
              ? {
                  status: sub.status,
                  currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
                  cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                }
              : null,
          };
        }),
      );

      return {
        success: true,
        data: enriched,
      };
    },
  );

  // ── Stripe Billing Portal ──

  app.post(
    "/me/billing-portal",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: userId } = (request as typeof request & { authUser: AuthenticatedUser }).authUser;

      // Find the user's tenant (use first owned tenant)
      const [membership] = await db
        .select({
          tenantId: tenantUsers.tenantId,
          role: tenantUsers.role,
          stripeCustomerId: tenants.stripeCustomerId,
        })
        .from(tenantUsers)
        .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
        .where(
          and(
            eq(tenantUsers.userId, userId),
            eq(tenantUsers.role, "owner"),
            isNull(tenants.deletedAt),
          ),
        )
        .limit(1);

      if (!membership) {
        void reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "No owned tenant found" },
        });
        return;
      }

      if (!membership.stripeCustomerId) {
        void reply.status(400).send({
          success: false,
          error: { code: "NO_BILLING", message: "Tenant has no billing account" },
        });
        return;
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: membership.stripeCustomerId,
        return_url: `${config.frontendUrl}/account/billing`,
      });

      return {
        success: true,
        data: { url: session.url },
      };
    },
  );
}
