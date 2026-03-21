import { useState, type FormEvent } from "react";
import {
  Loader2,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@frontend/components/ui/dialog.js";
import {
  useSubscription,
  useCreateSubscription,
  useSyncSubscription,
  useCancelSubscription,
  useInvoices,
} from "@frontend/hooks/use-billing.js";
import { ApiError } from "@frontend/api/client.js";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  canceled: "outline",
  incomplete: "outline",
  incomplete_expired: "outline",
  unpaid: "destructive",
};

const INVOICE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  open: "secondary",
  draft: "outline",
  void: "outline",
  uncollectible: "destructive",
};

/** Module labels for display */
const MODULE_LABELS: Record<string, string> = {
  "safespec-whs": "WHS",
  "safespec-hva": "HVA",
  "safespec-fleet-maintenance": "Fleet Maintenance",
  "nexum-core": "Core",
  "nexum-invoicing": "Invoicing",
  "nexum-rcti": "RCTI",
  "nexum-xero": "Xero",
  "nexum-compliance": "Compliance",
  "nexum-sms": "SMS",
  "nexum-dockets": "Dockets",
  "nexum-materials": "Materials",
  "nexum-map-planning": "Map Planning",
  "nexum-ai": "AI",
  "nexum-reporting": "Reporting",
  "nexum-portal": "Portal",
};

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface BillingTabProps {
  tenantId: string;
}

export function BillingTab({ tenantId }: BillingTabProps): React.JSX.Element {
  const {
    data: subscription,
    isPending: subLoading,
    error: subError,
  } = useSubscription(tenantId);
  const { data: invoiceList, isPending: invoicesLoading } =
    useInvoices(tenantId);
  const createSub = useCreateSubscription(tenantId);
  const syncSub = useSyncSubscription(tenantId);
  const cancelSub = useCancelSubscription(tenantId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [error, setError] = useState("");

  const hasNoSubscription =
    subError instanceof ApiError && subError.status === 404;

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    try {
      await createSub.mutateAsync({ billingInterval });
      setCreateDialogOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create subscription",
      );
    }
  }

  async function handleCancel(): Promise<void> {
    setError("");

    try {
      await cancelSub.mutateAsync({ atPeriodEnd: true });
      setCancelDialogOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel subscription",
      );
    }
  }

  if (subLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* ── No subscription ── */}
      {hasNoSubscription && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CreditCard className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              No active subscription for this tenant
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create Subscription
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Active subscription ── */}
      {subscription && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription className="font-mono text-xs">
                {subscription.stripeSubscriptionId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void syncSub.mutateAsync()}
                disabled={syncSub.isPending}
                title="Sync with Stripe"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncSub.isPending ? "animate-spin" : ""}`}
                />
              </Button>
              <Badge variant={STATUS_VARIANT[subscription.status] ?? "outline"}>
                {subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-sm">Period Start</dt>
                <dd className="font-medium">
                  {formatDate(subscription.currentPeriodStart)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Period End</dt>
                <dd className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">
                  Bundle Discount
                </dt>
                <dd className="font-medium">
                  {subscription.stripeCouponId
                    ? subscription.stripeCouponId.includes("15")
                      ? "15%"
                      : "10%"
                    : "None"}
                </dd>
              </div>
            </dl>

            {subscription.cancelAtPeriodEnd && (
              <div className="bg-destructive/10 flex items-center gap-2 rounded-md p-3 text-sm">
                <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
                <span>
                  Subscription will cancel at end of current billing period
                </span>
              </div>
            )}

            {/* Subscription line items */}
            {subscription.items.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Line Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="capitalize">
                          {item.productId}
                        </TableCell>
                        <TableCell>
                          {MODULE_LABELS[item.moduleId] ?? item.moduleId}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Cancel button */}
            {subscription.status === "active" &&
              !subscription.cancelAtPeriodEnd && (
                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancel Subscription
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* ── Invoices ── */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : !invoiceList?.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No invoices yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceList.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{formatDate(inv.createdAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          INVOICE_STATUS_VARIANT[inv.status] ?? "outline"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(inv.periodStart)} –{" "}
                      {formatDate(inv.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(inv.amountDue, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {inv.invoiceUrl && (
                          <a
                            href={inv.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="View invoice"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        )}
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Download PDF"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create Subscription Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subscription</DialogTitle>
            <DialogDescription>
              This will create a Stripe subscription using the tenant's active
              modules and matching plans.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>Billing Interval</Label>
              <select
                value={billingInterval}
                onChange={(e) =>
                  setBillingInterval(
                    e.target.value as "monthly" | "annual",
                  )
                }
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual (2 months free)</option>
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSub.isPending}>
                {createSub.isPending && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                Create Subscription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Subscription Dialog ── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              The subscription will remain active until the end of the current
              billing period. The tenant will not be charged again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleCancel()}
              disabled={cancelSub.isPending}
            >
              {cancelSub.isPending && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Cancel at Period End
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
