/**
 * Stripe Price Sync Script
 *
 * Reads all plans from the DB, creates/finds matching Stripe Products and Prices,
 * then updates plans with the Stripe price IDs. Also creates bundle coupons.
 *
 * Usage: pnpm stripe:sync
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { plans } from "../db/schema/billing.js";
import { stripe } from "../services/stripe.js";
import { STRIPE_COUPONS } from "@opshield/shared/constants";

async function findOrCreateProduct(
  name: string,
  moduleId: string,
  productId: string,
): Promise<string> {
  // Search for existing product by metadata
  const existing = await stripe.products.search({
    query: `metadata["moduleId"]:"${moduleId}" AND metadata["productId"]:"${productId}"`,
  });

  if (existing.data.length > 0 && existing.data[0]) {
    console.warn(`  Found existing Stripe product: ${existing.data[0].id}`);
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name,
    metadata: { moduleId, productId },
  });
  console.warn(`  Created Stripe product: ${product.id}`);
  return product.id;
}

async function findOrCreatePrice(
  stripeProductId: string,
  amountCents: number,
  interval: "month" | "year",
  nickname: string,
): Promise<string> {
  // Search for existing price
  const existing = await stripe.prices.list({
    product: stripeProductId,
    type: "recurring",
    active: true,
    limit: 100,
  });

  const match = existing.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.recurring?.interval === interval &&
      p.currency === "aud",
  );

  if (match) {
    console.warn(`  Found existing price: ${match.id} (${nickname})`);
    return match.id;
  }

  const price = await stripe.prices.create({
    product: stripeProductId,
    unit_amount: amountCents,
    currency: "aud",
    recurring: { interval },
    nickname,
  });
  console.warn(`  Created price: ${price.id} (${nickname})`);
  return price.id;
}

async function findOrCreateCoupon(
  couponId: string,
  percentOff: number,
): Promise<void> {
  try {
    await stripe.coupons.retrieve(couponId);
    console.warn(`  Coupon "${couponId}" already exists`);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      percent_off: percentOff,
      duration: "forever",
      name: `Bundle ${percentOff}% discount`,
    });
    console.warn(`  Created coupon: ${couponId} (${percentOff}% off)`);
  }
}

async function main(): Promise<void> {
  console.warn("=== Stripe Price Sync ===\n");

  // 1. Read all active plans
  const allPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, "true"));

  console.warn(`Found ${allPlans.length} active plans\n`);

  // 2. Group plans by module
  const byModule = new Map<string, typeof allPlans>();
  for (const plan of allPlans) {
    const key = `${plan.productId}:${plan.moduleId ?? "core"}`;
    const existing = byModule.get(key) ?? [];
    existing.push(plan);
    byModule.set(key, existing);
  }

  // 3. Process each module group
  for (const [key, modulePlans] of byModule) {
    console.warn(`\nProcessing module: ${key}`);
    const first = modulePlans[0];
    if (!first) continue;

    const stripeProductId = await findOrCreateProduct(
      `${first.productId} - ${first.moduleId ?? "core"} (${first.tier})`,
      first.moduleId ?? "core",
      first.productId,
    );

    for (const plan of modulePlans) {
      const interval = plan.billingInterval === "annual" ? "year" : "month";
      const baseCents = Math.round(Number(plan.basePrice) * 100);
      const perUserCents = Math.round(Number(plan.perUserPrice) * 100);

      // Base price
      const basePriceId = await findOrCreatePrice(
        stripeProductId,
        baseCents,
        interval as "month" | "year",
        `${plan.name} - Base (${plan.billingInterval})`,
      );

      // Per-user price (if applicable)
      let perUserPriceId: string | null = null;
      if (perUserCents > 0) {
        perUserPriceId = await findOrCreatePrice(
          stripeProductId,
          perUserCents,
          interval as "month" | "year",
          `${plan.name} - Per User (${plan.billingInterval})`,
        );
      }

      // Update plan with Stripe price IDs
      await db
        .update(plans)
        .set({
          stripePriceId: basePriceId,
          stripePerUserPriceId: perUserPriceId,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, plan.id));

      console.warn(`  Updated plan ${plan.id}: base=${basePriceId}, perUser=${perUserPriceId ?? "N/A"}`);
    }
  }

  // 4. Create bundle coupons
  console.warn("\n=== Bundle Coupons ===");
  await findOrCreateCoupon(STRIPE_COUPONS.BUNDLE_10_PERCENT, 10);
  await findOrCreateCoupon(STRIPE_COUPONS.BUNDLE_15_PERCENT, 15);

  console.warn("\n=== Sync Complete ===");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
