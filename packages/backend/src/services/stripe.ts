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
