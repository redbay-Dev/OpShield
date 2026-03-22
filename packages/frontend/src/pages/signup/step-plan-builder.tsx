import { useNavigate } from "react-router";
import { useMemo, useCallback } from "react";
import { Button } from "@frontend/components/ui/button";
import {
  BillingToggle,
  ProductCard,
  PriceSummary,
} from "@frontend/components/plan-builder";
import { usePlans } from "@frontend/hooks/use-plans.js";
import { useSignupContext, type ModuleSelection } from "./signup-context";
import {
  PRODUCT_CONFIG,
  PRODUCT_IDS,
} from "@opshield/shared/constants";
import { calculatePriceBreakdown } from "@opshield/shared/utils";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export function StepPlanBuilderPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const {
    billingInterval,
    setBillingInterval,
    selectedModules,
    enabledProducts,
    toggleProduct,
    toggleModule,
    updateModuleTier,
    isProductEnabled,
  } = useSignupContext();

  const selectedModuleIds = useMemo(
    () => new Set(selectedModules.map((m) => m.moduleId)),
    [selectedModules],
  );

  const breakdown = useMemo(() => {
    if (!plans) return null;
    return calculatePriceBreakdown(selectedModules, billingInterval, plans);
  }, [selectedModules, billingInterval, plans]);

  const handleToggleBaseModule = useCallback(
    (moduleId: string, productId: string, defaultTier: string) => {
      const existing = selectedModules.find((m) => m.moduleId === moduleId);
      const mod: ModuleSelection = existing ?? {
        productId,
        moduleId,
        tier: defaultTier,
      };
      toggleModule(mod);
    },
    [selectedModules, toggleModule],
  );

  const handleToggleAddon = useCallback(
    (addonId: string, productId: string) => {
      const existing = selectedModules.find((m) => m.moduleId === addonId);
      const mod: ModuleSelection = existing ?? {
        productId,
        moduleId: addonId,
        tier: "standard",
      };
      toggleModule(mod);
    },
    [selectedModules, toggleModule],
  );

  const hasBaseModule = selectedModules.some((m) => {
    for (const product of Object.values(PRODUCT_CONFIG)) {
      if (product.baseModules.some((bm) => bm.id === m.moduleId)) return true;
    }
    return false;
  });

  const canProceed = selectedModules.length > 0 && hasBaseModule;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose What You Need</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn on the products you want, pick a size that fits your team, and
          add any extras. Your price updates as you go.
        </p>
      </div>

      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <BillingToggle value={billingInterval} onChange={setBillingInterval} />
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        {PRODUCT_IDS.map((productId) => {
          const config = PRODUCT_CONFIG[productId];
          return (
            <ProductCard
              key={productId}
              productId={productId}
              config={config}
              plans={plans ?? []}
              billingInterval={billingInterval}
              isEnabled={isProductEnabled(productId)}
              onToggle={() => toggleProduct(productId)}
              selectedModuleIds={selectedModuleIds}
              selectedModules={selectedModules}
              enabledProducts={enabledProducts}
              onToggleModule={handleToggleBaseModule}
              onSelectTier={updateModuleTier}
              onToggleAddon={handleToggleAddon}
            />
          );
        })}
      </div>

      {/* Price summary */}
      {breakdown && <PriceSummary breakdown={breakdown} billingInterval={billingInterval} />}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => void navigate("/signup/company")}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          disabled={!canProceed}
          onClick={() => void navigate("/signup/review")}
        >
          Review & Checkout
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </div>
  );
}
