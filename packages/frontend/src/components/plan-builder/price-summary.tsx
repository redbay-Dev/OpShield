import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card";
import { Separator } from "@frontend/components/ui/separator";
import { Badge } from "@frontend/components/ui/badge";
import { getModuleDisplayName } from "@opshield/shared/constants";
import type { PriceBreakdown, PriceLineItem } from "@opshield/shared/utils";

interface PriceSummaryProps {
  breakdown: PriceBreakdown;
  billingInterval: "monthly" | "annual";
}

export function PriceSummary({
  breakdown,
  billingInterval,
}: PriceSummaryProps): React.JSX.Element {
  const intervalLabel = billingInterval === "annual" ? "yr" : "mo";
  const hasItems = breakdown.lineItems.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Price Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasItems ? (
          <p className="text-sm text-muted-foreground">
            Select a product to see pricing
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {breakdown.lineItems.map((item: PriceLineItem) => (
                <div
                  key={item.moduleId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>
                      {getModuleDisplayName(item.moduleId)}
                    </span>
                    {!item.isAddon && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.tierLabel}
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium">
                    ${item.basePrice.toFixed(2)}/{intervalLabel}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                ${breakdown.subtotal.toFixed(2)}/{intervalLabel}
              </span>
            </div>

            {breakdown.bundleDiscountPercent > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1.5">
                  Bundle discount ({breakdown.bundleDiscountPercent}%)
                </span>
                <span>-${breakdown.bundleDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>
                ${breakdown.total.toFixed(2)}/{intervalLabel}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              + GST (10%) added at checkout. All prices in AUD.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
