import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantModules, auditLog } from "../db/schema/tenants.js";
import { tenantUsers } from "../db/schema/tenant-users.js";
import { plans } from "../db/schema/billing.js";
import { requireAuth, type AuthenticatedUser } from "../middleware/require-auth.js";
import {
  signupCheckoutSchema,
  checkSlugQuerySchema,
} from "@opshield/shared/schemas";
import { SAFESPEC_MODULES, NEXUM_MODULES } from "@opshield/shared/constants";
import { createStripeCustomer } from "../services/stripe.js";
import { stripe } from "../services/stripe.js";
import { determineCouponId } from "../services/billing-utils.js";
import { config } from "../config.js";

/** All valid module IDs by product */
const VALID_MODULES: Record<string, ReadonlySet<string>> = {
  safespec: new Set(Object.values(SAFESPEC_MODULES)),
  nexum: new Set(Object.values(NEXUM_MODULES)),
};

function formatPlan(plan: typeof plans.$inferSelect): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    productId: plan.productId,
    moduleId: plan.moduleId,
    tier: plan.tier,
    basePrice: plan.basePrice,
    includedUsers: plan.includedUsers,
    perUserPrice: plan.perUserPrice,
    billingInterval: plan.billingInterval,
    features: plan.features ?? [],
  };
}

export async function signupRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /plans — Public pricing catalog ──
  app.get("/plans", async (_request, reply) => {
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, "true"));

    return reply.send({
      success: true,
      data: allPlans.map(formatPlan),
    });
  });

  // ── GET /signup/check-slug — Slug availability check ──
  app.get(
    "/signup/check-slug",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = checkSlugQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid slug" },
        });
      }

      const { slug } = parsed.data;

      const [existing] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)))
        .limit(1);

      return reply.send({
        success: true,
        data: { available: existing === undefined },
      });
    },
  );

  // ── POST /signup/checkout — Self-service checkout ──
  app.post(
    "/signup/checkout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const bodyParsed = signupCheckoutSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: bodyParsed.error.issues,
          },
        });
      }

      const authUser = (request as unknown as { authUser: AuthenticatedUser }).authUser;
      const { companyName, companySlug, billingEmail, billingInterval, modules } = bodyParsed.data;

      // Check user doesn't already own a tenant
      const [existingOwnership] = await db
        .select({ id: tenantUsers.id })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.userId, authUser.id), eq(tenantUsers.role, "owner")))
        .limit(1);

      if (existingOwnership) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "CONFLICT",
            message: "You already own a tenant. Contact support to manage your account.",
          },
        });
      }

      // Validate slug uniqueness
      const [existingSlug] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(and(eq(tenants.slug, companySlug), isNull(tenants.deletedAt)))
        .limit(1);

      if (existingSlug) {
        return reply.status(409).send({
          success: false,
          error: { code: "SLUG_TAKEN", message: "This company slug is already taken" },
        });
      }

      // Validate module selections
      for (const mod of modules) {
        const validModules = VALID_MODULES[mod.productId];
        if (!validModules?.has(mod.moduleId)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "INVALID_MODULE",
              message: `Module "${mod.moduleId}" is not valid for product "${mod.productId}"`,
            },
          });
        }
      }

      // Validate dependencies: Fleet Maintenance requires HVA
      const moduleIds = new Set(modules.map((m) => m.moduleId));
      if (moduleIds.has(SAFESPEC_MODULES.FLEET_MAINTENANCE) && !moduleIds.has(SAFESPEC_MODULES.HVA)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "DEPENDENCY_ERROR",
            message: "Fleet Maintenance requires the HVA module",
          },
        });
      }

      // Validate dependencies: Nexum Compliance requires SafeSpec
      if (moduleIds.has(NEXUM_MODULES.COMPLIANCE)) {
        const hasSafeSpec = modules.some((m) => m.productId === "safespec" && m.moduleId !== SAFESPEC_MODULES.FLEET_MAINTENANCE);
        if (!hasSafeSpec) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "DEPENDENCY_ERROR",
              message: "Nexum Compliance requires an active SafeSpec module (WHS or HVA)",
            },
          });
        }
      }

      // Validate Nexum optional modules require Nexum Core
      const hasNexumModules = modules.some((m) => m.productId === "nexum");
      const hasNexumCore = moduleIds.has(NEXUM_MODULES.CORE);
      if (hasNexumModules && !hasNexumCore) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "DEPENDENCY_ERROR",
            message: "Nexum modules require Nexum Core",
          },
        });
      }

      // Look up plans for each module + tier + billing interval
      const modulePlans: Array<{
        selection: (typeof modules)[number];
        plan: typeof plans.$inferSelect;
      }> = [];

      for (const mod of modules) {
        const [plan] = await db
          .select()
          .from(plans)
          .where(
            and(
              eq(plans.productId, mod.productId),
              eq(plans.moduleId, mod.moduleId),
              eq(plans.tier, mod.tier),
              eq(plans.billingInterval, billingInterval),
              eq(plans.isActive, "true"),
            ),
          )
          .limit(1);

        if (!plan) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "NO_PLAN",
              message: `No ${billingInterval} plan found for module "${mod.moduleId}" at tier "${mod.tier}"`,
            },
          });
        }

        if (!plan.stripePriceId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "STRIPE_NOT_CONFIGURED",
              message: `Pricing is not yet configured for "${mod.moduleId}". Please contact support.`,
            },
          });
        }

        modulePlans.push({ selection: mod, plan });
      }

      // Create tenant, modules, and user link in a transaction
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: companyName,
          slug: companySlug,
          status: "onboarding",
          billingEmail,
        })
        .returning();

      if (!tenant) {
        return reply.status(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Failed to create tenant" },
        });
      }

      // Insert modules
      for (const { selection, plan } of modulePlans) {
        await db.insert(tenantModules).values({
          tenantId: tenant.id,
          productId: selection.productId,
          moduleId: selection.moduleId,
          status: "active",
          maxUsers: plan.includedUsers,
        });
      }

      // Link user as owner
      await db.insert(tenantUsers).values({
        userId: authUser.id,
        tenantId: tenant.id,
        role: "owner",
      });

      // Create Stripe customer
      const customer = await createStripeCustomer(
        companyName,
        billingEmail,
        { tenantId: tenant.id, tenantSlug: companySlug },
      );

      await db
        .update(tenants)
        .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));

      // Build Stripe Checkout Session line items
      const lineItems: Array<{ price: string; quantity: number }> = [];
      for (const { plan } of modulePlans) {
        // Base price (validated non-null above)
        lineItems.push({ price: plan.stripePriceId!, quantity: 1 });
      }

      // Determine bundle coupon
      const couponId = determineCouponId(modules);

      // Create Stripe Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "subscription",
        line_items: lineItems,
        discounts: couponId ? [{ coupon: couponId }] : undefined,
        success_url: `${config.frontendUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/signup/cancelled`,
        subscription_data: {
          metadata: { tenantId: tenant.id, tenantSlug: companySlug },
        },
        metadata: {
          tenantId: tenant.id,
          userId: authUser.id,
          userName: authUser.name,
        },
      });

      // Audit log
      await db.insert(auditLog).values({
        actorId: authUser.id,
        actorType: "user",
        action: "signup.checkout_initiated",
        resourceType: "tenant",
        resourceId: tenant.id,
        metadata: {
          companyName,
          companySlug,
          billingInterval,
          moduleCount: modules.length,
          checkoutSessionId: checkoutSession.id,
        },
      });

      return reply.status(201).send({
        success: true,
        data: { checkoutUrl: checkoutSession.url },
      });
    },
  );
}
