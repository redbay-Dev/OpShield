import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { BillingToggle } from "@frontend/components/plan-builder";
import { usePlans } from "@frontend/hooks/use-plans.js";
import {
  PRODUCT_CONFIG,
  PRODUCT_IDS,
  type ProductId,
  type BaseModuleConfig,
} from "@opshield/shared/constants";
import type { PublicPlanResponse } from "@opshield/shared/schemas";
import { cn } from "@frontend/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = { ShieldCheck, Truck };

export function PricingPage(): React.JSX.Element {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const { data: allPlans, isLoading } = usePlans();

  const plans = useMemo(
    () => (allPlans ?? []).filter((p) => p.billingInterval === interval),
    [allPlans, interval],
  );

  const intervalLabel = interval === "annual" ? "yr" : "mo";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Pricing</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Everything you need to run safety compliance, transport operations,
          or both. Pick what fits your team.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mt-8 flex justify-center">
        <BillingToggle value={interval} onChange={setInterval} />
      </div>

      {isLoading && (
        <div className="mt-16 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && plans.length === 0 && (
        <div className="mt-16 text-center text-muted-foreground">
          <p>Pricing is being configured. Check back soon.</p>
        </div>
      )}

      {!isLoading && plans.length > 0 && (
        <div className="mt-12 space-y-12">
          {/* Each product */}
          {PRODUCT_IDS.map((productId) => {
            const config = PRODUCT_CONFIG[productId];
            const Icon = ICON_MAP[config.icon];
            const productPlans = plans.filter(
              (p) => p.productId === productId,
            );

            if (productPlans.length === 0) return null;

            return (
              <section key={productId}>
                {/* Product header */}
                <div className="mb-6 flex items-center gap-3">
                  {Icon && (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{config.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {config.tagline}
                    </p>
                  </div>
                </div>

                {/* Tier cards for each base module */}
                {config.baseModules.map((baseMod) => {
                  const modulePlans = productPlans.filter(
                    (p) => p.moduleId === baseMod.id,
                  );
                  if (modulePlans.length === 0) return null;

                  return (
                    <div key={baseMod.id} className="mb-8">
                      {config.baseModules.length > 1 && (
                        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                          {baseMod.fullName}
                        </h3>
                      )}
                      <TierCardGrid
                        baseMod={baseMod}
                        plans={modulePlans}
                        intervalLabel={intervalLabel}
                      />
                    </div>
                  );
                })}

                {/* Add-ons */}
                <AddonPriceList
                  productId={productId}
                  plans={productPlans}
                  intervalLabel={intervalLabel}
                />
              </section>
            );
          })}

          {/* Bundle discount callout */}
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <h3 className="font-semibold">Bundle & Save</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use both SafeSpec and Nexum? Get 10% off your total. Add 3 or
                more modules across both products and save 15%. Annual billing
                saves an additional 2 months.
              </p>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <Button size="lg" asChild>
              <Link to="/signup">
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              14-day free trial. No credit card required to start.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tier Cards ──

function TierCardGrid({
  baseMod,
  plans,
  intervalLabel,
}: {
  baseMod: BaseModuleConfig;
  plans: PublicPlanResponse[];
  intervalLabel: string;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {baseMod.tiers.map((tier) => {
        const plan = plans.find((p) => p.tier === tier.id);
        if (!plan) return null;

        const price = parseFloat(plan.basePrice);
        const perUser = parseFloat(plan.perUserPrice);
        const isPopular =
          tier.id === "growth" || tier.id === "professional" || tier.id === "small-fleet";

        return (
          <Card
            key={tier.id}
            className={cn(
              "flex flex-col",
              isPopular && "border-primary shadow-sm",
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{tier.label}</CardTitle>
                {isPopular && (
                  <Badge className="text-xs">Popular</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {tier.subtitle}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {/* Price */}
              <div className="mt-1">
                <span className="text-3xl font-bold">
                  ${price.toFixed(0)}
                </span>
                <span className="text-muted-foreground">
                  /{intervalLabel}
                </span>
              </div>

              {/* Users */}
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-3.5" />
                <span>
                  {plan.includedUsers} users included
                </span>
              </div>
              {perUser > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  +${perUser.toFixed(0)}/user/mo after that
                </p>
              )}

              {/* Features — from plan or from base module config */}
              {(() => {
                const features =
                  plan.features.length > 0
                    ? plan.features
                    : (baseMod.includedFeatures ?? []);
                if (features.length === 0) return null;
                return (
                  <ul className="mt-4 space-y-1.5">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}

              {/* CTA */}
              <div className="mt-auto pt-6">
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  asChild
                >
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Add-on Price List ──

function AddonPriceList({
  productId,
  plans,
  intervalLabel,
}: {
  productId: ProductId;
  plans: PublicPlanResponse[];
  intervalLabel: string;
}): React.JSX.Element | null {
  const config = PRODUCT_CONFIG[productId];
  const addonPlans = config.addons
    .map((addon) => {
      const plan = plans.find((p) => p.moduleId === addon.id);
      return plan ? { addon, plan } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (addonPlans.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        Add-ons
      </h3>
      <div className="rounded-lg border">
        {addonPlans.map(({ addon, plan }, i) => (
          <div
            key={addon.id}
            className={cn(
              "flex items-center justify-between px-4 py-3",
              i < addonPlans.length - 1 && "border-b",
            )}
          >
            <div>
              <p className="text-sm font-medium">{addon.name}</p>
              <p className="text-xs text-muted-foreground">
                {addon.description}
              </p>
            </div>
            <span className="whitespace-nowrap text-sm font-semibold">
              +${parseFloat(plan.basePrice).toFixed(0)}/{intervalLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
