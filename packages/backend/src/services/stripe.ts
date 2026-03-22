import Stripe from "stripe";
import { config } from "../config.js";

/**
 * Stripe SDK instance — configured with OpShield's secret key.
 */
/**
 * Stripe SDK instance.
 * Uses a placeholder key in test/dev when no real key is configured
 * so the module can load without throwing — actual calls will fail at runtime.
 */
export const stripe = new Stripe(
  config.stripe.secretKey || "sk_test_placeholder",
);

/** Metadata attached to all Stripe objects for traceability */
interface StripeMetadata {
  [key: string]: string;
}

/**
 * Create a Stripe customer for a tenant.
 */
export async function createStripeCustomer(
  name: string,
  email: string,
  metadata: StripeMetadata,
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    name,
    email,
    metadata,
  });
}

interface CreateSubscriptionItem {
  price: string;
  quantity?: number;
}

/**
 * Create a Stripe subscription for a customer.
 */
export async function createStripeSubscription(
  customerId: string,
  items: CreateSubscriptionItem[],
  couponId?: string,
  trialDays?: number,
  metadata?: StripeMetadata,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.create({
    customer: customerId,
    items,
    discounts: couponId ? [{ coupon: couponId }] : undefined,
    trial_period_days: trialDays,
    metadata: metadata ?? {},
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });
}

interface UpdateSubscriptionParams {
  addItems?: CreateSubscriptionItem[];
  removeItems?: string[];
  updateItems?: Array<{ id: string; quantity: number }>;
  couponId?: string;
  prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
}

/**
 * Update an existing Stripe subscription (add/remove/update items, change coupon).
 */
export async function updateStripeSubscription(
  subscriptionId: string,
  params: UpdateSubscriptionParams,
): Promise<Stripe.Subscription> {
  const updateParams: Stripe.SubscriptionUpdateParams = {
    proration_behavior: params.prorationBehavior ?? "create_prorations",
  };

  if (params.addItems && params.addItems.length > 0) {
    // Adding items requires separate API calls
    for (const item of params.addItems) {
      await stripe.subscriptionItems.create({
        subscription: subscriptionId,
        price: item.price,
        quantity: item.quantity ?? 1,
      });
    }
  }

  if (params.removeItems && params.removeItems.length > 0) {
    for (const itemId of params.removeItems) {
      await stripe.subscriptionItems.del(itemId, {
        proration_behavior: params.prorationBehavior ?? "create_prorations",
      });
    }
  }

  if (params.updateItems && params.updateItems.length > 0) {
    for (const item of params.updateItems) {
      await stripe.subscriptionItems.update(item.id, {
        quantity: item.quantity,
        proration_behavior: params.prorationBehavior ?? "create_prorations",
      });
    }
  }

  if (params.couponId !== undefined) {
    updateParams.discounts = params.couponId
      ? [{ coupon: params.couponId }]
      : [];
  }

  return stripe.subscriptions.update(subscriptionId, updateParams);
}

/**
 * Cancel a Stripe subscription.
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean,
): Promise<Stripe.Subscription> {
  if (atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Retrieve a Stripe subscription.
 */
export async function getStripeSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

/**
 * Sync a plan's pricing to Stripe.
 * Creates or finds a Stripe Product and Price, then returns the price IDs.
 * Called automatically when plans are created or updated via the admin API.
 */
export async function syncPlanToStripe(plan: {
  name: string;
  productId: string;
  moduleId: string | null;
  tier: string;
  basePrice: string;
  perUserPrice: string;
  billingInterval: string;
}): Promise<{ stripePriceId: string; stripePerUserPriceId: string | null }> {
  const moduleId = plan.moduleId ?? "core";
  const interval = plan.billingInterval === "annual" ? "year" : "month";

  // One Stripe product per plan (module + tier), not per module
  const productKey = `${plan.productId}|${moduleId}|${plan.tier}`;
  const existing = await stripe.products.search({
    query: `metadata["planKey"]:"${productKey}"`,
  });

  let stripeProductId: string;
  if (existing.data.length > 0 && existing.data[0]) {
    stripeProductId = existing.data[0].id;
    // Update product name if it changed
    await stripe.products.update(stripeProductId, {
      name: `${plan.name} (${moduleId})`,
    });
  } else {
    const product = await stripe.products.create({
      name: `${plan.name} (${moduleId})`,
      metadata: { planKey: productKey, moduleId, productId: plan.productId, tier: plan.tier },
    });
    stripeProductId = product.id;
  }

  // Find existing price or create new one
  const baseCents = Math.round(Number(plan.basePrice) * 100);
  const stripePriceId = await findOrCreatePrice(
    stripeProductId,
    baseCents,
    interval as "month" | "year",
    `${plan.name} ${plan.tier} (${plan.billingInterval})`,
  );

  return { stripePriceId, stripePerUserPriceId: null };
}

/**
 * Find an existing active price matching amount+interval, or create a new one.
 * Since each plan has its own Stripe product, there's no collision risk.
 */
async function findOrCreatePrice(
  productId: string,
  amountCents: number,
  interval: "month" | "year",
  nickname: string,
): Promise<string> {
  const existing = await stripe.prices.list({
    product: productId,
    type: "recurring",
    active: true,
    limit: 10,
  });

  const match = existing.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.recurring?.interval === interval &&
      p.currency === "aud",
  );

  if (match) return match.id;

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: "aud",
    recurring: { interval },
    nickname,
  });

  return price.id;
}

/**
 * Verify a webhook signature and construct the event.
 */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret,
  );
}
