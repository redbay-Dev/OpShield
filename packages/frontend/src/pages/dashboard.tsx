import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Loader2,
  Truck,
  ShieldCheck,
  HardHat,
  Wrench,
  ExternalLink,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { authClient } from "@frontend/lib/auth-client.js";
import { useMyTenants } from "@frontend/hooks/use-account.js";
import { useAdminStatus } from "@frontend/hooks/use-admin-status.js";
import { apiGet } from "@frontend/api/client.js";
import type { MyTenant, TenantModule } from "@frontend/api/account.js";

/**
 * Product configuration for the app launcher.
 * Maps productId to display info.
 */
const PRODUCT_CONFIG: Record<
  string,
  {
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    colour: string;
  }
> = {
  nexum: {
    name: "Nexum",
    description: "Operations Management",
    icon: Truck,
    colour: "bg-blue-600",
  },
  safespec: {
    name: "Safety & Compliance",
    description: "WHS & HVA Management",
    icon: ShieldCheck,
    colour: "bg-emerald-600",
  },
};

/**
 * Module display labels and icons for the module list within each product card.
 */
const MODULE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  // SafeSpec modules
  whs: { label: "Work Health & Safety", icon: HardHat },
  hva: { label: "Heavy Vehicle Accreditation", icon: Truck },
  "fleet-maintenance": { label: "Fleet Maintenance", icon: Wrench },
  // Nexum modules
  core: { label: "Core", icon: Truck },
  invoicing: { label: "Invoicing", icon: Truck },
  rcti: { label: "RCTI", icon: Truck },
  xero: { label: "Xero Integration", icon: Truck },
  compliance: { label: "Compliance", icon: ShieldCheck },
  sms: { label: "SMS", icon: Truck },
  dockets: { label: "Docket Processing", icon: Truck },
  materials: { label: "Materials", icon: Truck },
  "map-planning": { label: "Map Planning", icon: Truck },
  ai: { label: "AI Automation", icon: Truck },
  reporting: { label: "Reporting", icon: Truck },
  portal: { label: "Portal", icon: Truck },
};

/**
 * Group modules by productId.
 */
function groupModulesByProduct(
  modules: TenantModule[],
): Record<string, TenantModule[]> {
  const groups: Record<string, TenantModule[]> = {};
  for (const mod of modules) {
    if (mod.status !== "active") continue;
    const list = groups[mod.productId] ?? [];
    list.push(mod);
    groups[mod.productId] = list;
  }
  return groups;
}

interface AppLinks {
  nexum: string;
  safespec: string;
}

function ProductCard({
  productId,
  modules,
  launchUrl,
  tenantStatus,
}: {
  productId: string;
  modules: TenantModule[];
  launchUrl: string | undefined;
  tenantStatus: string;
}): React.JSX.Element {
  const productInfo = PRODUCT_CONFIG[productId] ?? {
    name: productId,
    description: "",
    icon: Truck,
    colour: "bg-gray-600",
  };
  const IconComponent = productInfo.icon;
  const isSuspended = tenantStatus === "suspended" || tenantStatus === "cancelled";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${productInfo.colour} text-white`}
        >
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">{productInfo.name}</CardTitle>
          <CardDescription>{productInfo.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Module list */}
        <div className="flex flex-wrap gap-1.5">
          {modules.map((mod) => {
            const modInfo = MODULE_CONFIG[mod.moduleId];
            return (
              <Badge key={mod.moduleId} variant="secondary" className="text-xs">
                {modInfo?.label ?? mod.moduleId}
              </Badge>
            );
          })}
        </div>

        {/* Launch button */}
        <div className="mt-auto pt-2">
          {isSuspended ? (
            <Button variant="outline" disabled className="w-full">
              Account {tenantStatus}
            </Button>
          ) : launchUrl ? (
            <Button asChild className="w-full">
              <a href={launchUrl}>
                Open {productInfo.name}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled className="w-full">
              Not available
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * App Launcher / Dashboard page.
 *
 * This is the default landing page after login for tenant users.
 * Shows the user's subscribed products with launch buttons.
 * Platform admins also see a link to the admin dashboard.
 * Tenant owners/admins see a link to account management.
 */
export function AppLauncherPage(): React.JSX.Element {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: tenants, isPending: tenantsPending } = useMyTenants();
  const { data: adminStatus } = useAdminStatus(Boolean(session));
  const navigate = useNavigate();
  const [appLinks, setAppLinks] = useState<AppLinks | null>(null);
  const [linksLoading, setLinksLoading] = useState(true);

  // Fetch app launch links from backend
  useEffect(() => {
    apiGet<AppLinks>("/me/app-links")
      .then((data) => {
        setAppLinks(data);
        setLinksLoading(false);
      })
      .catch(() => {
        setLinksLoading(false);
      });
  }, []);

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    void navigate("/auth/login");
  }

  const isPending = sessionPending || tenantsPending || linksLoading;

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Get the first tenant (most users have one)
  const tenant: MyTenant | undefined = tenants?.[0];
  const moduleGroups = tenant ? groupModulesByProduct(tenant.modules) : {};
  const productIds = Object.keys(moduleGroups);
  const isOwnerOrAdmin = tenant?.role === "owner" || tenant?.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {tenant?.name ?? "Nexum Platform"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {adminStatus?.isPlatformAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate("/admin")}
              >
                <Settings className="mr-1.5 h-4 w-4" />
                Platform Admin
              </Button>
            )}
            {isOwnerOrAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate("/account")}
              >
                <Settings className="mr-1.5 h-4 w-4" />
                Account
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-8 lg:px-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back{session?.user.name ? `, ${session.user.name}` : ""}
            </h1>
            <p className="text-muted-foreground mt-1">
              Select an application to get started
            </p>
          </div>

          {!tenant ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <p className="text-muted-foreground">
                  You are not a member of any organisation yet.
                </p>
                <Button onClick={() => void navigate("/signup")}>
                  Create an organisation
                </Button>
              </CardContent>
            </Card>
          ) : productIds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <p className="text-muted-foreground">
                  No active modules found for {tenant.name}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {productIds.map((productId) => (
                <ProductCard
                  key={productId}
                  productId={productId}
                  modules={moduleGroups[productId] ?? []}
                  launchUrl={
                    appLinks?.[productId as keyof AppLinks] ?? undefined
                  }
                  tenantStatus={tenant.status}
                />
              ))}
            </div>
          )}

          {/* If user has multiple tenants, show switcher */}
          {tenants && tenants.length > 1 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Other Organisations
              </h2>
              <div className="grid gap-3">
                {tenants.slice(1).map((t) => {
                  const otherGroups = groupModulesByProduct(t.modules);
                  const otherProducts = Object.keys(otherGroups);
                  return (
                    <Card key={t.tenantId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {otherProducts
                              .map(
                                (pid) =>
                                  PRODUCT_CONFIG[pid]?.name ?? pid,
                              )
                              .join(", ")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            t.status === "active" ? "default" : "destructive"
                          }
                        >
                          {t.status}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
