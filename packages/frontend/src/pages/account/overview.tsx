import { Loader2, Building2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { useMyTenants } from "@frontend/hooks/use-account.js";
import type { MyTenant } from "@frontend/api/account.js";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  onboarding: "secondary",
  suspended: "destructive",
  cancelled: "outline",
};

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

function StatusIcon({ status }: { status: string }): React.JSX.Element {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "suspended":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function TenantCard({ tenant }: { tenant: MyTenant }): React.JSX.Element {
  const activeModules = tenant.modules.filter((m) => m.status === "active");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-md">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{tenant.name}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {tenant.slug}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon status={tenant.status} />
          <Badge variant={STATUS_VARIANT[tenant.status] ?? "outline"}>
            {tenant.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Modules */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Active Modules
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeModules.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active modules</p>
            ) : (
              activeModules.map((m) => (
                <Badge key={m.moduleId} variant="secondary" className="text-xs">
                  <span className="capitalize">{m.productId}</span>
                  {" — "}
                  {MODULE_LABELS[m.moduleId] ?? m.moduleId}
                  <span className="text-muted-foreground ml-1">
                    ({m.currentUsers}/{m.maxUsers} users)
                  </span>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Subscription */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Subscription
          </p>
          {tenant.subscription ? (
            <div className="flex items-center gap-3">
              <Badge variant={SUB_STATUS_VARIANT[tenant.subscription.status] ?? "outline"}>
                {tenant.subscription.status}
              </Badge>
              {tenant.subscription.currentPeriodEnd && (
                <span className="text-muted-foreground text-sm">
                  Renews {formatDate(tenant.subscription.currentPeriodEnd)}
                </span>
              )}
              {tenant.subscription.cancelAtPeriodEnd && (
                <span className="text-destructive text-sm">
                  Cancelling at period end
                </span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No active subscription</p>
          )}
        </div>

        {/* Role */}
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">
            Your role: <span className="capitalize font-medium text-foreground">{tenant.role}</span>
          </p>
          <span className="text-muted-foreground text-xs">
            — Member since {formatDate(tenant.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountOverviewPage(): React.JSX.Element {
  const { data: tenants, isPending } = useMyTenants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
        <p className="text-muted-foreground">
          Your organisations and subscriptions
        </p>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : !tenants?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Building2 className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              You are not a member of any organisations yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <TenantCard key={tenant.tenantId} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  );
}
