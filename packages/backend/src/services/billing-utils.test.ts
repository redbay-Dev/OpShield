import { describe, it, expect } from "vitest";
import { determineCouponId } from "./billing-utils.js";
import { STRIPE_COUPONS } from "@opshield/shared/constants";

describe("determineCouponId", () => {
  it("returns undefined for single-product modules", () => {
    const modules = [
      { productId: "safespec" },
    ];
    expect(determineCouponId(modules)).toBeUndefined();
  });

  it("returns undefined for modules from same product", () => {
    const modules = [
      { productId: "safespec" },
      { productId: "safespec" },
    ];
    expect(determineCouponId(modules)).toBeUndefined();
  });

  it("returns 10% bundle coupon for exactly two modules from two products", () => {
    const modules = [
      { productId: "safespec" },
      { productId: "nexum" },
    ];
    expect(determineCouponId(modules)).toBe(STRIPE_COUPONS.BUNDLE_10_PERCENT);
  });

  it("returns 15% bundle coupon for 3+ modules across both products", () => {
    const modules = [
      { productId: "safespec" },
      { productId: "safespec" },
      { productId: "nexum" },
    ];
    expect(determineCouponId(modules)).toBe(STRIPE_COUPONS.BUNDLE_15_PERCENT);
  });

  it("returns 15% for 4 modules across both products", () => {
    const modules = [
      { productId: "safespec" },
      { productId: "safespec" },
      { productId: "nexum" },
      { productId: "nexum" },
    ];
    expect(determineCouponId(modules)).toBe(STRIPE_COUPONS.BUNDLE_15_PERCENT);
  });

  it("returns undefined for empty modules", () => {
    expect(determineCouponId([])).toBeUndefined();
  });
});
