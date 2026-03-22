import type { PublicPlanResponse } from "../schemas/index.js";
import { getBundleDiscountPercent } from "../constants/index.js";

/** A single line item in the price breakdown */
export interface PriceLineItem {
  moduleId: string;
  productId: string;
  moduleName: string;
  tier: string;
  tierLabel: string;
  basePrice: number;
  includedUsers: number;
  perUserPrice: number;
  isAddon: boolean;
}

/** Full price breakdown result */
export interface PriceBreakdown {
  lineItems: PriceLineItem[];
  subtotal: number;
  bundleDiscountPercent: number;
  bundleDiscountAmount: number;
  total: number;
}

/** Module selection input */
export interface ModuleSelection {
  productId: string;
  moduleId: string;
  tier: string;
}

/**
 * Calculate a full price breakdown for a set of selected modules.
 *
 * Matches each selection against the plans array to find pricing,
 * applies bundle discount rules, and returns structured output.
 */
export function calculatePriceBreakdown(
  selectedModules: readonly ModuleSelection[],
  billingInterval: "monthly" | "annual",
  plans: readonly PublicPlanResponse[],
  moduleDisplayNames?: Record<string, string>,
): PriceBreakdown {
  const lineItems: PriceLineItem[] = [];

  for (const selection of selectedModules) {
    const plan = plans.find(
      (p) =>
        p.moduleId === selection.moduleId &&
        p.tier === selection.tier &&
        p.billingInterval === billingInterval,
    );

    if (!plan) continue;

    const price = parseFloat(plan.basePrice);
    const perUser = parseFloat(plan.perUserPrice);
    const isAddon = perUser === 0 && plan.includedUsers <= 1;

    lineItems.push({
      moduleId: plan.moduleId,
      productId: plan.productId,
      moduleName:
        moduleDisplayNames?.[plan.moduleId] ?? plan.name,
      tier: plan.tier,
      tierLabel: plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1),
      basePrice: price,
      includedUsers: plan.includedUsers,
      perUserPrice: perUser,
      isAddon,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.basePrice, 0);

  const bundleDiscountPercent = getBundleDiscountPercent(selectedModules);
  const bundleDiscountAmount =
    Math.round(subtotal * (bundleDiscountPercent / 100) * 100) / 100;

  const total = Math.round((subtotal - bundleDiscountAmount) * 100) / 100;

  return {
    lineItems,
    subtotal,
    bundleDiscountPercent,
    bundleDiscountAmount,
    total,
  };
}
