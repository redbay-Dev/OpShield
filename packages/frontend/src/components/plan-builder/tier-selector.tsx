import { Check, Users } from "lucide-react";
import { cn } from "@frontend/lib/utils";
import type { TierConfig } from "@opshield/shared/constants";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

interface TierSelectorProps {
  moduleId: string;
  tiers: readonly TierConfig[];
  plans: readonly PublicPlanResponse[];
  billingInterval: "monthly" | "annual";
  selectedTier: string | null;
  onSelectTier: (tier: string) => void;
}

export function TierSelector({
  moduleId,
  tiers,
  plans,
  billingInterval,
  selectedTier,
  onSelectTier,
}: TierSelectorProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => {
        const plan = plans.find(
          (p) =>
            p.moduleId === moduleId &&
            p.tier === tier.id &&
            p.billingInterval === billingInterval,
        );

        const isEnterprise = tier.id === "enterprise";
        const isSelected = selectedTier === tier.id;
        const price = plan ? parseFloat(plan.basePrice) : null;
        const perUser = plan ? parseFloat(plan.perUserPrice) : null;
        const includedUsers = plan?.includedUsers ?? 0;

        return (
          <button
            key={tier.id}
            type="button"
            disabled={isEnterprise && !plan}
            onClick={() => {
              if (!isEnterprise || plan) {
                onSelectTier(tier.id);
              }
            }}
            className={cn(
              "relative flex flex-col rounded-lg border p-4 text-left transition-all",
              "hover:border-primary/50 hover:shadow-sm",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card",
            )}
          >
            {isSelected && (
              <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary">
                <Check className="size-3 text-primary-foreground" />
              </div>
            )}

            <span className="text-sm font-semibold">{tier.label}</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tier.subtitle}
            </p>

            {isEnterprise && !plan ? (
              <div className="mt-2">
                <span className="text-lg font-bold text-muted-foreground">
                  Custom
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact us for pricing
                </p>
              </div>
            ) : price !== null ? (
              <div className="mt-2">
                <span className="text-2xl font-bold">
                  ${price.toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{billingInterval === "annual" ? "yr" : "mo"}
                </span>

                {includedUsers > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    <span>
                      {includedUsers} users included
                      {perUser && perUser > 0
                        ? `, then $${perUser.toFixed(0)}/user/mo`
                        : ""}
                    </span>
                  </div>
                )}

                {plan?.features && plan.features.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-1.5 text-xs text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
