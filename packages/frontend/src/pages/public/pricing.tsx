import { useState, useMemo } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "@frontend/components/ui/tabs.js";
import { usePlans } from "@frontend/hooks/use-plans.js";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

/** Display-friendly module names */
const MODULE_NAMES: Record<string, string> = {
  "safespec-whs": "WHS Module",
  "safespec-hva": "HVA Compliance",
  "safespec-fleet-maintenance": "Fleet Maintenance",
  "nexum-core": "Nexum Core",
  "nexum-invoicing": "Invoicing",
  "nexum-rcti": "RCTI",
  "nexum-xero": "Xero Integration",
  "nexum-compliance": "Compliance",
  "nexum-sms": "SMS Messaging",
  "nexum-dockets": "Docket Processing",
  "nexum-materials": "Materials",
  "nexum-map-planning": "Map Planning",
  "nexum-ai": "AI Automation",
  "nexum-reporting": "Reporting & Analytics",
  "nexum-portal": "Portal",
};

function PlanCard({ plan }: { plan: PublicPlanResponse }): React.JSX.Element {
  const price = parseFloat(plan.basePrice);
  const perUser = parseFloat(plan.perUserPrice);
  const isAnnual = plan.billingInterval === "annual";

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">{plan.tier}</CardTitle>
          {plan.tier === "professional" && (
            <Badge variant="secondary">Popular</Badge>
          )}
        </div>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price.toFixed(0)}</span>
          <span className="text-muted-foreground">/{isAnnual ? "year" : "month"}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Includes {plan.includedUsers} user{plan.includedUsers !== 1 ? "s" : ""}
          {perUser > 0 && `, then $${perUser.toFixed(0)}/user/month`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {plan.features.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-4">
          <Button className="w-full" asChild>
            <Link to="/signup">
              Get Started
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleSection({
  title,
  description,
  plans: modulePlans,
}: {
  title: string;
  description: string;
  plans: PublicPlanResponse[];
}): React.JSX.Element {
  return (
    <div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulePlans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}

/** Group plans for flat add-on modules (Nexum optional + Fleet Maintenance) */
function AddOnTable({ addOns }: { addOns: PublicPlanResponse[] }): React.JSX.Element {
  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-2.5 text-sm font-medium text-muted-foreground">
        <span>Module</span>
        <span>Price</span>
      </div>
      {addOns.map((plan) => (
        <div key={plan.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <span className="text-sm font-medium">{MODULE_NAMES[plan.moduleId] ?? plan.moduleId}</span>
          <span className="text-sm text-muted-foreground">
            ${parseFloat(plan.basePrice).toFixed(0)}/{plan.billingInterval === "annual" ? "year" : "month"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PricingPage(): React.JSX.Element {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const { data: allPlans, isLoading } = usePlans();

  const filteredPlans = useMemo(
    () => (allPlans ?? []).filter((p) => p.billingInterval === interval),
    [allPlans, interval],
  );

  // Group plans by product/module
  const safespecWhs = filteredPlans.filter((p) => p.moduleId === "safespec-whs");
  const safespecHva = filteredPlans.filter((p) => p.moduleId === "safespec-hva");
  const safespecFleet = filteredPlans.filter((p) => p.moduleId === "safespec-fleet-maintenance");
  const nexumCore = filteredPlans.filter((p) => p.moduleId === "nexum-core");
  const nexumAddOns = filteredPlans.filter(
    (p) => p.productId === "nexum" && p.moduleId !== "nexum-core",
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h1>
        <p className="mt-3 text-muted-foreground">
          All prices in AUD, excluding GST. Bundle both products for up to 15% off.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mt-8 flex justify-center">
        <Tabs value={interval} onValueChange={(v) => setInterval(v as "monthly" | "annual")}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">
              Annual
              <Badge variant="secondary" className="ml-2">Save 2 months</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && (
        <div className="mt-16 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filteredPlans.length === 0 && (
        <div className="mt-16 text-center text-muted-foreground">
          <p>No pricing plans configured yet. Please check back soon.</p>
        </div>
      )}

      {!isLoading && filteredPlans.length > 0 && (
        <div className="mt-12 space-y-16">
          {/* SafeSpec */}
          <div>
            <h2 className="mb-6 text-2xl font-bold">SafeSpec</h2>
            <div className="space-y-10">
              {safespecWhs.length > 0 && (
                <ModuleSection
                  title="WHS Module"
                  description="Work Health & Safety — hazards, incidents, inspections, SWMS, corrective actions"
                  plans={safespecWhs}
                />
              )}
              {safespecHva.length > 0 && (
                <ModuleSection
                  title="HVA Compliance"
                  description="Heavy Vehicle Accreditation — fatigue, mass management, fitness to drive, SMS builder"
                  plans={safespecHva}
                />
              )}
              {safespecFleet.length > 0 && (
                <>
                  <h3 className="text-xl font-semibold">Fleet Maintenance</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Premium add-on for HVA — requires HVA module
                  </p>
                  <AddOnTable addOns={safespecFleet} />
                </>
              )}
            </div>
          </div>

          {/* Nexum */}
          <div>
            <h2 className="mb-6 text-2xl font-bold">Nexum</h2>
            <div className="space-y-10">
              {nexumCore.length > 0 && (
                <ModuleSection
                  title="Core"
                  description="Jobs, scheduling, business entities, and dashboard — always included"
                  plans={nexumCore}
                />
              )}
              {nexumAddOns.length > 0 && (
                <>
                  <h3 className="text-xl font-semibold">Optional Modules</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add capabilities to Nexum Core. Each is a flat monthly add-on using Core&apos;s user allocation.
                  </p>
                  <AddOnTable addOns={nexumAddOns} />
                </>
              )}
            </div>
          </div>

          {/* Bundle note */}
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <h3 className="font-semibold">Bundle discount</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscribe to both SafeSpec and Nexum to save. 10% off with any combination, or 15% off with 3+ modules across both products.
                Annual billing saves an additional 2 months.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
