import { STRIPE_COUPONS } from "@opshield/shared/constants";

/**
 * Determine bundle coupon eligibility based on selected modules.
 * Both products active → 10% (3+ modules → 15%).
 */
export function determineCouponId(
  modules: Array<{ productId: string }>,
): string | undefined {
  const products = new Set(modules.map((m) => m.productId));
  if (products.size < 2) return undefined;

  // 15% if 3+ total modules across both products
  if (modules.length >= 3) {
    return STRIPE_COUPONS.BUNDLE_15_PERCENT;
  }
  return STRIPE_COUPONS.BUNDLE_10_PERCENT;
}
