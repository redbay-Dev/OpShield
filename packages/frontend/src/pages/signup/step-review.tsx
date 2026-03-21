import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { useSignupContext } from "./signup-context.js";
import { usePlans } from "@frontend/hooks/use-plans.js";
import { useCheckout } from "@frontend/hooks/use-signup.js";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

const MODULE_NAMES: Record<string, string> = {
  "safespec-whs": "SafeSpec — WHS Module",
  "safespec-hva": "SafeSpec — HVA Compliance",
  "safespec-fleet-maintenance": "SafeSpec — Fleet Maintenance",
  "nexum-core": "Nexum — Core",
  "nexum-invoicing": "Nexum — Invoicing",
  "nexum-rcti": "Nexum — RCTI",
  "nexum-xero": "Nexum — Xero Integration",
  "nexum-compliance": "Nexum — Compliance",
  "nexum-sms": "Nexum — SMS Messaging",
  "nexum-dockets": "Nexum — Docket Processing",
  "nexum-materials": "Nexum — Materials",
  "nexum-map-planning": "Nexum — Map Planning",
  "nexum-ai": "Nexum — AI Automation",
  "nexum-reporting": "Nexum — Reporting & Analytics",
  "nexum-portal": "Nexum — Portal",
};

function findPlan(
  plans: PublicPlanResponse[],
  moduleId: string,
  tier: string,
  interval: string,
): PublicPlanResponse | undefined {
  return plans.find(
    (p) => p.moduleId === moduleId && p.tier === tier && p.billingInterval === interval,
  );
}

export function StepReviewPage(): React.JSX.Element {
  const ctx = useSignupContext();
  const { data: allPlans } = usePlans();
  const checkout = useCheckout();
  const [error, setError] = useState("");

  const lineItems = useMemo(() => {
    if (!allPlans) return [];
    return ctx.selectedModules.map((mod) => {
      const plan = findPlan(allPlans, mod.moduleId, mod.tier, ctx.billingInterval);
      return {
        moduleId: mod.moduleId,
        tier: mod.tier,
        price: plan ? parseFloat(plan.basePrice) : 0,
        includedUsers: plan?.includedUsers ?? 0,
      };
    });
  }, [allPlans, ctx.selectedModules, ctx.billingInterval]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);

  // Bundle discount calculation
  const products = new Set(ctx.selectedModules.map((m) => m.productId));
  const hasBothProducts = products.size >= 2;
  const discountPercent = hasBothProducts
    ? ctx.selectedModules.length >= 3
      ? 15
      : 10
    : 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const isAnnual = ctx.billingInterval === "annual";

  async function handleCheckout(): Promise<void> {
    setError("");
    try {
      const checkoutUrl = await checkout.mutateAsync({
        companyName: ctx.companyName,
        companySlug: ctx.companySlug,
        billingEmail: ctx.billingEmail,
        billingInterval: ctx.billingInterval,
        modules: ctx.selectedModules,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setError(message);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review your order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company info */}
          <div>
            <p className="text-sm text-muted-foreground">Company</p>
            <p className="font-medium">{ctx.companyName}</p>
            <p className="text-sm text-muted-foreground">{ctx.companySlug} &middot; {ctx.billingEmail}</p>
          </div>

          <Separator />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Module</span>
              <span>Price</span>
            </div>
            <div className="mt-2 space-y-2">
              {lineItems.map((item) => (
                <div key={item.moduleId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{MODULE_NAMES[item.moduleId] ?? item.moduleId}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="capitalize">{item.tier}</span>
                      {item.includedUsers > 0 && ` · ${item.includedUsers} users included`}
                    </p>
                  </div>
                  <span className="text-sm">
                    ${item.price.toFixed(2)}/{isAnnual ? "yr" : "mo"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}/{isAnnual ? "yr" : "mo"}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span className="flex items-center gap-1">
                  Bundle discount
                  <Badge variant="secondary" className="text-xs">{discountPercent}% off</Badge>
                </span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-semibold">
              <span>Total (excl. GST)</span>
              <span>${total.toFixed(2)}/{isAnnual ? "yr" : "mo"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              GST (10%) will be added at checkout. All prices in AUD.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={checkout.isPending}
        onClick={() => void handleCheckout()}
      >
        {checkout.isPending && <Loader2 className="animate-spin" data-icon="inline-start" />}
        Proceed to Payment
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be redirected to Stripe for secure payment processing.
      </p>
    </div>
  );
}
