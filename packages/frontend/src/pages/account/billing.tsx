import { Loader2, CreditCard, ExternalLink, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import { useMyTenants, useBillingPortal } from "@frontend/hooks/use-account.js";
import { toast } from "sonner";
import type { MyTenant } from "@frontend/api/account.js";

const SUB_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  canceled: "outline",
};

const MODULE_LABELS: Record<string, string> = {
  whs: "WHS",
  hva: "HVA",
  "fleet-maintenance": "Fleet Maintenance",
  core: "Core",
  invoicing: "Invoicing",
  rcti: "RCTI",
  xero: "Xero",
  compliance: "Compliance",
  sms: "SMS",
  dockets: "Dockets",
  materials: "Materials",
  "map-planning": "Map Planning",
  ai: "AI",
  reporting: "Reporting",
  portal: "Portal",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TenantBillingCard({ tenant }: { tenant: MyTenant }): React.JSX.Element {
  const activeModules = tenant.modules.filter((m) => m.status === "active");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{tenant.name}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {tenant.slug}
              </CardDescription>
            </div>
          </div>
          {tenant.subscription && (
            <Badge variant={SUB_STATUS_VARIANT[tenant.subscription.status] ?? "outline"}>
              {tenant.subscription.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription details */}
        {tenant.subscription ? (
          <div className="space-y-3">
            {tenant.subscription.currentPeriodEnd && (
              <p className="text-sm">
                <span className="text-muted-foreground">Next billing date: </span>
                <span className="font-medium">
                  {formatDate(tenant.subscription.currentPeriodEnd)}
                </span>
              </p>
            )}

            {tenant.subscription.cancelAtPeriodEnd && (
              <div className="bg-destructive/10 flex items-center gap-2 rounded-md p-3 text-sm">
                <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
                <span>
                  Subscription will cancel at end of current billing period
                </span>
              </div>
            )}

            {/* Active modules */}
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">
                Subscribed Modules
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeModules.map((m) => (
                  <Badge key={m.moduleId} variant="secondary" className="text-xs">
                    <span className="capitalize">{m.productId}</span>
                    {" — "}
                    {MODULE_LABELS[m.moduleId] ?? m.moduleId}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No active subscription
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BillingPage(): React.JSX.Element {
  const { data: tenants, isPending } = useMyTenants();
  const billingPortal = useBillingPortal();

  const ownedTenants = tenants?.filter((t) => t.role === "owner") ?? [];
  const memberTenants = tenants?.filter((t) => t.role !== "owner") ?? [];

  async function handleManageBilling(): Promise<void> {
    try {
      const result = await billingPortal.mutateAsync();
      window.location.href = result.url;
    } catch {
      toast.error(
        "Unable to open billing portal — your organisation may not have billing set up yet",
      );
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">
            Manage subscriptions and payment methods
          </p>
        </div>
        {ownedTenants.length > 0 && (
          <Button
            onClick={() => void handleManageBilling()}
            disabled={billingPortal.isPending}
          >
            {billingPortal.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Manage Billing
          </Button>
        )}
      </div>

      {!tenants?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CreditCard className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              No billing information available
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {ownedTenants.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your Organisations</h2>
              {ownedTenants.map((t) => (
                <TenantBillingCard key={t.tenantId} tenant={t} />
              ))}
            </div>
          )}

          {memberTenants.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Member Organisations</h2>
              <p className="text-muted-foreground text-sm">
                Contact the organisation owner to manage billing for these.
              </p>
              {memberTenants.map((t) => (
                <TenantBillingCard key={t.tenantId} tenant={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
