import { useEffect, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@frontend/components/ui/field.js";
import { Input } from "@frontend/components/ui/input.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import { RadioGroup, RadioGroupItem } from "@frontend/components/ui/radio-group.js";
import { Label } from "@frontend/components/ui/label.js";
import { Tabs, TabsList, TabsTrigger } from "@frontend/components/ui/tabs.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { useSignupContext, type ModuleSelection } from "./signup-context.js";
import { useCheckSlug } from "@frontend/hooks/use-signup.js";
import { usePlans } from "@frontend/hooks/use-plans.js";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

/** Display names for modules */
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

/** Nexum optional modules (flat add-ons) */
const NEXUM_OPTIONAL = [
  "nexum-invoicing", "nexum-rcti", "nexum-xero", "nexum-compliance",
  "nexum-sms", "nexum-dockets", "nexum-materials", "nexum-map-planning",
  "nexum-ai", "nexum-reporting", "nexum-portal",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function TieredModuleSelector({
  moduleId,
  productId,
  plans: modulePlans,
  selected,
  onToggle,
  onTierChange,
  disabled,
}: {
  moduleId: string;
  productId: string;
  plans: PublicPlanResponse[];
  selected: ModuleSelection | undefined;
  onToggle: (mod: ModuleSelection) => void;
  onTierChange: (moduleId: string, tier: string) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const isSelected = selected !== undefined;
  const defaultTier = modulePlans[0]?.tier ?? "starter";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`mod-${moduleId}`}
          checked={isSelected}
          disabled={disabled}
          onCheckedChange={() => {
            onToggle({ productId, moduleId, tier: selected?.tier ?? defaultTier });
          }}
        />
        <Label htmlFor={`mod-${moduleId}`} className="font-medium">
          {MODULE_NAMES[moduleId] ?? moduleId}
        </Label>
      </div>
      {isSelected && modulePlans.length > 1 && (
        <div className="mt-3 pl-7">
          <RadioGroup
            value={selected.tier}
            onValueChange={(tier) => onTierChange(moduleId, tier)}
          >
            {modulePlans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-2">
                <RadioGroupItem value={plan.tier} id={`tier-${plan.id}`} />
                <Label htmlFor={`tier-${plan.id}`} className="text-sm">
                  <span className="capitalize">{plan.tier}</span>
                  {" — "}
                  <span className="text-muted-foreground">
                    ${parseFloat(plan.basePrice).toFixed(0)}/mo
                    {" · "}
                    {plan.includedUsers} users included
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );
}

export function StepCompanyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const ctx = useSignupContext();
  const { data: allPlans, isLoading: plansLoading } = usePlans();
  const slugToCheck = ctx.companySlug;
  const { data: slugAvailable, isLoading: slugChecking } = useCheckSlug(slugToCheck, slugToCheck.length >= 2);

  // Auto-generate slug from company name
  useEffect(() => {
    if (ctx.companyName) {
      ctx.setCompanySlug(slugify(ctx.companyName));
    }
  }, [ctx.companyName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter plans by billing interval
  const plans = useMemo(
    () => (allPlans ?? []).filter((p) => p.billingInterval === ctx.billingInterval),
    [allPlans, ctx.billingInterval],
  );

  // Group plans by module
  const plansByModule = useMemo(() => {
    const map = new Map<string, PublicPlanResponse[]>();
    for (const plan of plans) {
      const key = plan.moduleId;
      const existing = map.get(key) ?? [];
      existing.push(plan);
      map.set(key, existing);
    }
    return map;
  }, [plans]);

  const selectedModuleIds = new Set(ctx.selectedModules.map((m) => m.moduleId));
  const hasNexumCore = selectedModuleIds.has("nexum-core");
  const hasHva = selectedModuleIds.has("safespec-hva");
  const hasSafeSpec = ctx.selectedModules.some(
    (m) => m.productId === "safespec" && m.moduleId !== "safespec-fleet-maintenance",
  );

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (ctx.selectedModules.length === 0) return;
    void navigate("/signup/review");
  }

  const canProceed =
    ctx.companyName.length >= 2 &&
    ctx.companySlug.length >= 2 &&
    ctx.billingEmail.length > 0 &&
    ctx.selectedModules.length > 0 &&
    slugAvailable !== false;

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>Tell us about your business</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company-name">Company Name</FieldLabel>
                <Input
                  id="company-name"
                  value={ctx.companyName}
                  onChange={(e) => ctx.setCompanyName(e.target.value)}
                  placeholder="Smith Haulage Pty Ltd"
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-slug">URL Slug</FieldLabel>
                <Input
                  id="company-slug"
                  value={ctx.companySlug}
                  onChange={(e) => ctx.setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="smith-haulage"
                  required
                />
                <FieldDescription>
                  {slugChecking && "Checking availability..."}
                  {!slugChecking && slugAvailable === true && ctx.companySlug.length >= 2 && "Available"}
                  {!slugChecking && slugAvailable === false && "This slug is already taken"}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="billing-email">Billing Email</FieldLabel>
                <Input
                  id="billing-email"
                  type="email"
                  value={ctx.billingEmail}
                  onChange={(e) => ctx.setBillingEmail(e.target.value)}
                  placeholder="accounts@company.com.au"
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Billing Interval */}
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={ctx.billingInterval} onValueChange={(v) => ctx.setBillingInterval(v as "monthly" | "annual")}>
              <TabsList className="w-full">
                <TabsTrigger value="monthly" className="flex-1">Monthly</TabsTrigger>
                <TabsTrigger value="annual" className="flex-1">
                  Annual (save 2 months)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Module Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select your modules</CardTitle>
            <CardDescription>Choose the products and modules you need</CardDescription>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* SafeSpec */}
                <div>
                  <h3 className="mb-3 font-semibold">SafeSpec</h3>
                  <div className="space-y-3">
                    {(["safespec-whs", "safespec-hva"] as const).map((moduleId) => (
                      <TieredModuleSelector
                        key={moduleId}
                        moduleId={moduleId}
                        productId="safespec"
                        plans={plansByModule.get(moduleId) ?? []}
                        selected={ctx.selectedModules.find((m) => m.moduleId === moduleId)}
                        onToggle={ctx.toggleModule}
                        onTierChange={ctx.updateModuleTier}
                      />
                    ))}
                    {/* Fleet Maintenance (requires HVA) */}
                    {(plansByModule.get("safespec-fleet-maintenance") ?? []).length > 0 && (
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="mod-fleet"
                            checked={selectedModuleIds.has("safespec-fleet-maintenance")}
                            disabled={!hasHva}
                            onCheckedChange={() => {
                              const plan = plansByModule.get("safespec-fleet-maintenance")?.[0];
                              if (plan) {
                                ctx.toggleModule({
                                  productId: "safespec",
                                  moduleId: "safespec-fleet-maintenance",
                                  tier: plan.tier,
                                });
                              }
                            }}
                          />
                          <Label htmlFor="mod-fleet" className="font-medium">
                            Fleet Maintenance
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              ${parseFloat(plansByModule.get("safespec-fleet-maintenance")?.[0]?.basePrice ?? "0").toFixed(0)}/mo add-on
                            </span>
                          </Label>
                        </div>
                        {!hasHva && (
                          <p className="mt-1 pl-7 text-xs text-muted-foreground">Requires HVA module</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Nexum */}
                <div>
                  <h3 className="mb-3 font-semibold">Nexum</h3>
                  <div className="space-y-3">
                    <TieredModuleSelector
                      moduleId="nexum-core"
                      productId="nexum"
                      plans={plansByModule.get("nexum-core") ?? []}
                      selected={ctx.selectedModules.find((m) => m.moduleId === "nexum-core")}
                      onToggle={ctx.toggleModule}
                      onTierChange={ctx.updateModuleTier}
                    />

                    {hasNexumCore && (
                      <div className="space-y-2 pl-4">
                        <p className="text-sm text-muted-foreground">Optional modules:</p>
                        {NEXUM_OPTIONAL.map((moduleId) => {
                          const modulePlans = plansByModule.get(moduleId) ?? [];
                          const plan = modulePlans[0];
                          if (!plan) return null;
                          const isCompliance = moduleId === "nexum-compliance";
                          const disabled = isCompliance && !hasSafeSpec;

                          return (
                            <div key={moduleId} className="flex items-center gap-3 rounded-lg border p-3">
                              <Checkbox
                                id={`mod-${moduleId}`}
                                checked={selectedModuleIds.has(moduleId)}
                                disabled={disabled}
                                onCheckedChange={() => {
                                  ctx.toggleModule({
                                    productId: "nexum",
                                    moduleId,
                                    tier: plan.tier,
                                  });
                                }}
                              />
                              <Label htmlFor={`mod-${moduleId}`} className="flex-1 text-sm">
                                {MODULE_NAMES[moduleId] ?? moduleId}
                                {disabled && (
                                  <span className="ml-1 text-xs text-muted-foreground">(requires SafeSpec)</span>
                                )}
                              </Label>
                              <span className="text-sm text-muted-foreground">
                                ${parseFloat(plan.basePrice).toFixed(0)}/mo
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={!canProceed}>
          Review Order
        </Button>
      </div>
    </form>
  );
}
