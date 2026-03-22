import { Checkbox } from "@frontend/components/ui/checkbox";
import { Label } from "@frontend/components/ui/label";
import { cn } from "@frontend/lib/utils";
import type { AddonConfig } from "@opshield/shared/constants";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

interface AddonListProps {
  addons: readonly AddonConfig[];
  plans: readonly PublicPlanResponse[];
  billingInterval: "monthly" | "annual";
  selectedModuleIds: Set<string>;
  enabledProducts: Set<string>;
  onToggle: (addonId: string, productId: string) => void;
  productId: string;
}

export function AddonList({
  addons,
  plans,
  billingInterval,
  selectedModuleIds,
  enabledProducts,
  onToggle,
  productId,
}: AddonListProps): React.JSX.Element | null {
  if (addons.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Optional Modules
      </h4>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {addons.map((addon) => {
          const plan = plans.find(
            (p) =>
              p.moduleId === addon.id &&
              p.billingInterval === billingInterval,
          );

          const price = plan ? parseFloat(plan.basePrice) : null;
          const isSelected = selectedModuleIds.has(addon.id);

          // Check dependency
          let isDisabled = false;
          let disabledReason = "";
          if (addon.requires && !selectedModuleIds.has(addon.requires)) {
            isDisabled = true;
            disabledReason = `Requires ${addon.requires.split("-").pop() ?? "module"}`;
          }
          if (
            addon.requiresProduct &&
            !enabledProducts.has(addon.requiresProduct)
          ) {
            isDisabled = true;
            disabledReason = `Requires ${addon.requiresProduct === "safespec" ? "SafeSpec" : "Nexum"}`;
          }

          return (
            <label
              key={addon.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                "hover:bg-accent/50",
                isSelected && "border-primary/30 bg-primary/5",
                isDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              <Checkbox
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={() => {
                  if (!isDisabled) {
                    onToggle(addon.id, productId);
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <Label
                  className={cn(
                    "cursor-pointer text-sm font-medium",
                    isDisabled && "cursor-not-allowed",
                  )}
                >
                  {addon.name}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {disabledReason || addon.description}
                </p>
              </div>
              {price !== null && (
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  ${price.toFixed(0)}/
                  {billingInterval === "annual" ? "yr" : "mo"}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
