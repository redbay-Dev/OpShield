import {
  STRIPE_COUPONS,
  getBundleDiscountPercent,
} from "@opshield/shared/constants";

/**
 * Determine bundle coupon eligibility based on selected modules.
 * Both products active → 10% (3+ modules → 15%).
 */
export function determineCouponId(
  modules: Array<{ productId: string }>,
): string | undefined {
  const percent = getBundleDiscountPercent(modules);
  if (percent === 0) return undefined;
  if (percent >= 15) return STRIPE_COUPONS.BUNDLE_15_PERCENT;
  return STRIPE_COUPONS.BUNDLE_10_PERCENT;
}
