import { ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { Switch } from "@frontend/components/ui/switch";
import { Card, CardContent, CardHeader } from "@frontend/components/ui/card";
import { Label } from "@frontend/components/ui/label";
import { Checkbox } from "@frontend/components/ui/checkbox";
import { cn } from "@frontend/lib/utils";
import type {
  ProductConfig,
  ProductId,
} from "@opshield/shared/constants";
import type { PublicPlanResponse } from "@opshield/shared/schemas";
import { TierSelector } from "./tier-selector";
import { AddonList } from "./addon-list";

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  Truck,
};

interface ProductCardProps {
  productId: ProductId;
  config: ProductConfig;
  plans: readonly PublicPlanResponse[];
  billingInterval: "monthly" | "annual";
  isEnabled: boolean;
  onToggle: () => void;
  selectedModuleIds: Set<string>;
  selectedModules: ReadonlyArray<{
    moduleId: string;
    tier: string;
  }>;
  enabledProducts: Set<string>;
  onToggleModule: (moduleId: string, productId: string, defaultTier: string) => void;
  onSelectTier: (moduleId: string, tier: string) => void;
  onToggleAddon: (addonId: string, productId: string) => void;
}

export function ProductCard({
  productId,
  config,
  plans,
  billingInterval,
  isEnabled,
  onToggle,
  selectedModuleIds,
  selectedModules,
  enabledProducts,
  onToggleModule,
  onSelectTier,
  onToggleAddon,
}: ProductCardProps): React.JSX.Element {
  const Icon = ICON_MAP[config.icon];

  return (
    <Card
      className={cn(
        "transition-all",
        isEnabled
          ? "border-primary/30 shadow-sm"
          : "border-border opacity-80",
      )}
    >
      <CardHeader className="space-y-0 pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  isEnabled
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{config.name}</h3>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={onToggle} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{config.tagline}</p>
      </CardHeader>

      {isEnabled && (
        <CardContent className="space-y-6 pt-4">
          {/* Base modules */}
          {config.baseModules.map((baseMod) => {
            const isModuleSelected = selectedModuleIds.has(baseMod.id);
            const selectedEntry = selectedModules.find(
              (m) => m.moduleId === baseMod.id,
            );
            const selectedTier = selectedEntry?.tier ?? null;

            return (
              <div key={baseMod.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  {baseMod.required ? (
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">
                        {baseMod.fullName}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        (always included)
                      </span>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={isModuleSelected}
                        onCheckedChange={() =>
                          onToggleModule(
                            baseMod.id,
                            productId,
                            baseMod.tiers[0]?.id ?? "starter",
                          )
                        }
                      />
                      <Label className="cursor-pointer text-sm font-semibold">
                        {baseMod.fullName}
                      </Label>
                    </label>
                  )}
                </div>

                {baseMod.description && (
                  <p className="text-xs text-muted-foreground">
                    {baseMod.description}
                  </p>
                )}

                {(baseMod.required || isModuleSelected) && (
                  <TierSelector
                    moduleId={baseMod.id}
                    tiers={baseMod.tiers}
                    plans={plans}
                    billingInterval={billingInterval}
                    selectedTier={selectedTier}
                    onSelectTier={(tier) => onSelectTier(baseMod.id, tier)}
                  />
                )}
              </div>
            );
          })}

          {/* Add-ons */}
          {config.addons.length > 0 && (
            <div className="border-t pt-4">
              <AddonList
                addons={config.addons}
                plans={plans}
                billingInterval={billingInterval}
                selectedModuleIds={selectedModuleIds}
                enabledProducts={enabledProducts}
                onToggle={onToggleAddon}
                productId={productId}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
