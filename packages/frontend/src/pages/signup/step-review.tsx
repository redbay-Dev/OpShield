import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { calculatePriceBreakdown, type PriceLineItem } from "@opshield/shared/utils";
import {
  getModuleDisplayName,
  getProductForModule,
  PRODUCT_CONFIG,
} from "@opshield/shared/constants";

export function StepReviewPage(): React.JSX.Element {
  const navigate = useNavigate();
  const ctx = useSignupContext();
  const { data: allPlans } = usePlans();
  const checkout = useCheckout();
  const [error, setError] = useState("");

  const breakdown = useMemo(() => {
    if (!allPlans) return null;
    return calculatePriceBreakdown(
      ctx.selectedModules,
      ctx.billingInterval,
      allPlans,
    );
  }, [allPlans, ctx.selectedModules, ctx.billingInterval]);

  const isAnnual = ctx.billingInterval === "annual";
  const intervalLabel = isAnnual ? "yr" : "mo";

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
      const message =
        err instanceof Error ? err.message : "Checkout failed";
      setError(message);
    }
  }

  // Group line items by product for display
  const groupedItems = useMemo(() => {
    if (!breakdown) return [];
    const groups: Array<{
      productId: string;
      productName: string;
      items: PriceLineItem[];
    }> = [];

    for (const item of breakdown.lineItems) {
      const productId = getProductForModule(item.moduleId) ?? item.productId;
      let group = groups.find((g) => g.productId === productId);
      if (!group) {
        const config = PRODUCT_CONFIG[productId as keyof typeof PRODUCT_CONFIG];
        group = {
          productId,
          productName: config?.name ?? productId,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(item);
    }

    return groups;
  }, [breakdown]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company info */}
          <div>
            <p className="text-sm text-muted-foreground">Company</p>
            <p className="font-medium">{ctx.companyName}</p>
            <p className="text-sm text-muted-foreground">
              {ctx.companySlug} &middot; {ctx.billingEmail}
            </p>
          </div>

          <Separator />

          {/* Line items grouped by product */}
          {groupedItems.map((group) => (
            <div key={group.productId}>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                {group.productName}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.moduleId}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {getModuleDisplayName(item.moduleId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!item.isAddon && (
                          <span className="capitalize">{item.tierLabel}</span>
                        )}
                        {item.includedUsers > 0 &&
                          !item.isAddon &&
                          ` · ${item.includedUsers} users included`}
                      </p>
                    </div>
                    <span className="text-sm">
                      ${item.basePrice.toFixed(2)}/{intervalLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Separator />

          {/* Totals */}
          {breakdown && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>
                  ${breakdown.subtotal.toFixed(2)}/{intervalLabel}
                </span>
              </div>
              {breakdown.bundleDiscountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span className="flex items-center gap-1">
                    Bundle discount
                    <Badge variant="secondary" className="text-xs">
                      {breakdown.bundleDiscountPercent}% off
                    </Badge>
                  </span>
                  <span>
                    -${breakdown.bundleDiscountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-semibold">
                <span>Total (excl. GST)</span>
                <span>
                  ${breakdown.total.toFixed(2)}/{intervalLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                GST (10%) will be added at checkout. All prices in AUD.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => void navigate("/signup/plan")}
        >
          <ArrowLeft className="mr-2 size-4" />
          Edit Plan
        </Button>
        <Button
          size="lg"
          disabled={checkout.isPending}
          onClick={() => void handleCheckout()}
        >
          {checkout.isPending && (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          )}
          Proceed to Payment
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be redirected to Stripe for secure payment processing.
      </p>
    </div>
  );
}
