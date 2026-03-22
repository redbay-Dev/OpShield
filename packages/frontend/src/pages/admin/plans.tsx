import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Check,
  ShieldCheck,
  Truck,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/components/ui/tabs.js";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@frontend/api/client.js";
import { useAdminPermissions } from "@frontend/hooks/use-admin-permissions.js";
import {
  PRODUCT_CONFIG,
  PRODUCT_IDS,
  type TierConfig,
  type BaseModuleConfig,
  type AddonConfig,
} from "@opshield/shared/constants";
import { cn } from "@frontend/lib/utils.js";

// ── Types ──

interface Plan {
  id: string;
  name: string;
  productId: string;
  moduleId: string;
  tier: string;
  basePrice: string;
  includedUsers: number;
  perUserPrice: string;
  billingInterval: string;
  stripePriceId: string | null;
  stripePerUserPriceId: string | null;
  features: string[];
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

/** What the user edits per tier row */
interface TierPriceRow {
  basePrice: string;
  includedUsers: string;
  perUserPrice: string;
}

/** What the user edits per add-on row */
interface AddonPriceRow {
  basePrice: string;
}

interface ReconciliationData {
  summary: {
    totalPlans: number;
    activePlans: number;
    synced: number;
    broken: number;
    unsynced: number;
    inactive: number;
  };
  synced: Array<Plan & Record<string, unknown>>;
  broken: Array<Plan & { issue?: string }>;
  unsynced: Array<Plan & Record<string, unknown>>;
  inactive: Array<Plan & Record<string, unknown>>;
}

interface SyncAllResult {
  summary: {
    total: number;
    synced: number;
    failed: number;
    skipped: number;
  };
  results: Array<{
    planId: string;
    name: string;
    status: "synced" | "failed" | "skipped";
    error?: string;
  }>;
}

interface BulkDeleteResult {
  deletedCount: number;
  skippedCount: number;
  errors: Array<{ planId: string; reason: string }>;
}

const ICON_MAP: Record<string, LucideIcon> = { ShieldCheck, Truck };

function formatDecimal(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

// ── Main Component ──

export function PlansPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { canUpdate } = useAdminPermissions();

  // Track which rows are being edited and their values
  const [editingTiers, setEditingTiers] = useState<
    Record<string, TierPriceRow>
  >({});
  const [editingAddons, setEditingAddons] = useState<
    Record<string, AddonPriceRow>
  >({});

  const { data: plans, isPending } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async (): Promise<Plan[]> => {
      return apiGet<Plan[]>("/plans/admin");
    },
  });

  // Index plans by moduleId+tier+interval for fast lookup
  const planIndex = useMemo(() => {
    const idx: Record<string, Plan> = {};
    for (const plan of plans ?? []) {
      idx[`${plan.moduleId}:${plan.tier}:${plan.billingInterval}`] = plan;
    }
    return idx;
  }, [plans]);

  function findPlan(
    moduleId: string,
    tier: string,
    interval: string,
  ): Plan | undefined {
    return planIndex[`${moduleId}:${tier}:${interval}`];
  }

  // ── Save mutation (create or update a plan) ──

  const saveMutation = useMutation({
    mutationFn: async ({
      productId,
      moduleId,
      tier,
      name,
      basePrice,
      includedUsers,
      perUserPrice,
    }: {
      productId: string;
      moduleId: string;
      tier: string;
      name: string;
      basePrice: string;
      includedUsers: number;
      perUserPrice: string;
    }): Promise<void> => {
      // Save both monthly and annual at once
      const monthlyPlan = findPlan(moduleId, tier, "monthly");
      const annualMultiplier = 10; // 2 months free
      const monthlyBase = parseFloat(basePrice);
      const annualBase = monthlyBase * annualMultiplier;

      if (monthlyPlan) {
        await apiPatch(`/plans/${monthlyPlan.id}`, {
          name,
          basePrice: formatDecimal(basePrice),
          includedUsers,
          perUserPrice: formatDecimal(perUserPrice),
        });
      } else {
        await apiPost("/plans", {
          name,
          productId,
          moduleId,
          tier,
          basePrice: formatDecimal(basePrice),
          includedUsers,
          perUserPrice: formatDecimal(perUserPrice),
          billingInterval: "monthly",
          features: [],
        });
      }

      const annualPlan = findPlan(moduleId, tier, "annual");
      if (annualPlan) {
        await apiPatch(`/plans/${annualPlan.id}`, {
          name,
          basePrice: formatDecimal(annualBase.toString()),
          includedUsers,
          perUserPrice: formatDecimal(perUserPrice),
        });
      } else {
        await apiPost("/plans", {
          name,
          productId,
          moduleId,
          tier,
          basePrice: formatDecimal(annualBase.toString()),
          includedUsers,
          perUserPrice: formatDecimal(perUserPrice),
          billingInterval: "annual",
          features: [],
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Price saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Tier editing helpers ──

  function tierKey(moduleId: string, tierId: string): string {
    return `${moduleId}:${tierId}`;
  }

  function startEditTier(
    moduleId: string,
    tierId: string,
    existing: Plan | undefined,
  ): void {
    const key = tierKey(moduleId, tierId);
    setEditingTiers((prev) => ({
      ...prev,
      [key]: {
        basePrice: existing?.basePrice ?? "",
        includedUsers: String(existing?.includedUsers ?? 5),
        perUserPrice: existing?.perUserPrice ?? "0",
      },
    }));
  }

  function updateTierField(
    key: string,
    field: keyof TierPriceRow,
    value: string,
  ): void {
    setEditingTiers((prev) => {
      const existing: TierPriceRow = prev[key] ?? {
        basePrice: "",
        includedUsers: "5",
        perUserPrice: "0",
      };
      return { ...prev, [key]: { ...existing, [field]: value } };
    });
  }

  function saveTier(
    productId: string,
    moduleId: string,
    tier: TierConfig,
  ): void {
    const key = tierKey(moduleId, tier.id);
    const row = editingTiers[key];
    if (!row || !row.basePrice) return;

    void saveMutation
      .mutateAsync({
        productId,
        moduleId,
        tier: tier.id,
        name: `${tier.label}`,
        basePrice: row.basePrice,
        includedUsers: parseInt(row.includedUsers, 10) || 5,
        perUserPrice: row.perUserPrice,
      })
      .then(() => {
        setEditingTiers((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });
  }

  // ── Add-on editing helpers ──

  function startEditAddon(
    addonId: string,
    existing: Plan | undefined,
  ): void {
    setEditingAddons((prev) => ({
      ...prev,
      [addonId]: {
        basePrice: existing?.basePrice ?? "",
      },
    }));
  }

  function saveAddon(
    productId: string,
    addon: AddonConfig,
  ): void {
    const row = editingAddons[addon.id];
    if (!row || !row.basePrice) return;

    void saveMutation
      .mutateAsync({
        productId,
        moduleId: addon.id,
        tier: "standard",
        name: addon.name,
        basePrice: row.basePrice,
        includedUsers: 0,
        perUserPrice: "0",
      })
      .then(() => {
        setEditingAddons((prev) => {
          const next = { ...prev };
          delete next[addon.id];
          return next;
        });
      });
  }

  // ── Render ──

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPlans = plans?.length ?? 0;
  const activePlans =
    plans?.filter((p) => p.isActive === "true").length ?? 0;
  const linkedPlans =
    plans?.filter((p) => p.stripePriceId).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">
          Set the price for each product tier and add-on. Prices sync to
          Stripe automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{totalPlans} prices configured</span>
        <span>&middot;</span>
        <span>{activePlans} active</span>
        <span>&middot;</span>
        <span>{linkedPlans} synced to Stripe</span>
      </div>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">Pricing Editor</TabsTrigger>
          <TabsTrigger value="stripe-sync">Stripe Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-6 mt-4">
          {/* Product sections */}
          {PRODUCT_IDS.map((productId) => {
            const productConfig = PRODUCT_CONFIG[productId];
            const Icon = ICON_MAP[productConfig.icon];

            return (
              <Card key={productId}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{productConfig.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {productConfig.tagline}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Base modules with tiers */}
                  {productConfig.baseModules.map((baseMod) => (
                    <BaseModulePricingSection
                      key={baseMod.id}
                      baseMod={baseMod}
                      findPlan={findPlan}
                      editingTiers={editingTiers}
                      canUpdate={canUpdate}
                      isSaving={saveMutation.isPending}
                      onStartEdit={startEditTier}
                      onUpdateField={updateTierField}
                      onSave={(tier) => saveTier(productId, baseMod.id, tier)}
                      tierKey={tierKey}
                    />
                  ))}

                  {/* Add-ons */}
                  {productConfig.addons.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                          Add-ons
                        </h4>
                        <div className="space-y-2">
                          {productConfig.addons.map((addon) => {
                            const existingPlan = findPlan(
                              addon.id,
                              "standard",
                              "monthly",
                            );
                            const isEditing = addon.id in editingAddons;
                            const row = editingAddons[addon.id];
                            const hasPrice = !!existingPlan;

                            return (
                              <div
                                key={addon.id}
                                className="flex items-center gap-4 rounded-md border p-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">
                                    {addon.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {addon.description}
                                  </p>
                                </div>

                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm text-muted-foreground">
                                        $
                                      </span>
                                      <Input
                                        className="h-8 w-20"
                                        placeholder="29"
                                        value={row?.basePrice ?? ""}
                                        onChange={(e) =>
                                          setEditingAddons((prev) => ({
                                            ...prev,
                                            [addon.id]: {
                                              basePrice: e.target.value,
                                            },
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            saveAddon(productId, addon);
                                        }}
                                        autoFocus
                                      />
                                      <span className="text-sm text-muted-foreground">
                                        /mo
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-8"
                                      disabled={
                                        !row?.basePrice || saveMutation.isPending
                                      }
                                      onClick={() =>
                                        saveAddon(productId, addon)
                                      }
                                    >
                                      <Save className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : hasPrice ? (
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                                    onClick={() =>
                                      canUpdate &&
                                      startEditAddon(addon.id, existingPlan)
                                    }
                                    disabled={!canUpdate}
                                  >
                                    <span>
                                      ${parseFloat(existingPlan.basePrice).toFixed(0)}/mo
                                    </span>
                                    {existingPlan.stripePriceId && (
                                      <Check className="size-3 text-green-600" />
                                    )}
                                  </button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    disabled={!canUpdate}
                                    onClick={() =>
                                      startEditAddon(addon.id, undefined)
                                    }
                                  >
                                    Set price
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="stripe-sync" className="mt-4">
          <StripeSyncPanel canUpdate={canUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Stripe Sync Panel ──

function StripeSyncPanel({ canUpdate }: { canUpdate: boolean }): React.JSX.Element {
  const queryClient = useQueryClient();

  const invalidateAll = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["admin-plans-reconciliation"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
  };

  const {
    data: reconciliation,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-plans-reconciliation"],
    queryFn: async (): Promise<ReconciliationData> => {
      return apiGet<ReconciliationData>("/plans/admin/reconciliation");
    },
    retry: false,
  });

  const syncAllMutation = useMutation({
    mutationFn: async (force: boolean = false): Promise<SyncAllResult> => {
      return apiPost<SyncAllResult>("/plans/admin/sync-all", { force });
    },
    onSuccess: async (data) => {
      const { synced, failed, skipped } = data.summary;
      if (failed > 0) {
        toast.error(`Synced ${synced}, failed ${failed}, skipped ${skipped}`);
      } else if (synced > 0) {
        toast.success(`Synced ${synced} plans to Stripe`);
      } else {
        toast.info("All plans already synced");
      }
      await invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncSingleMutation = useMutation({
    mutationFn: async (planId: string): Promise<Plan> => {
      return apiPost<Plan>(`/plans/${planId}/sync`, {});
    },
    onSuccess: async () => {
      toast.success("Plan synced to Stripe");
      await invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePlansMutation = useMutation({
    mutationFn: async ({ planIds, permanent }: { planIds: string[]; permanent: boolean }): Promise<BulkDeleteResult> => {
      return apiDelete<BulkDeleteResult>("/plans/admin/bulk", { planIds, permanent });
    },
    onSuccess: async (data) => {
      if (data.deletedCount > 0) {
        toast.success(`Deleted ${data.deletedCount} plans`);
      }
      if (data.errors.length > 0) {
        toast.error(data.errors.map((e) => e.reason).join(", "));
      }
      await invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    const errMsg = error instanceof Error ? error.message : "Failed to load";
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{errMsg}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 size-3.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reconciliation) return <></>;

  const { summary } = reconciliation;
  const hasProblems = summary.broken > 0 || summary.unsynced > 0;
  const anyMutating =
    syncAllMutation.isPending ||
    syncSingleMutation.isPending ||
    deletePlansMutation.isPending;

  // Combine all plans into one flat list for the table
  const allPlans = [
    ...reconciliation.synced.map((p) => ({ ...p, status: "synced" as const })),
    ...reconciliation.broken.map((p) => ({ ...p, status: "broken" as const })),
    ...reconciliation.unsynced.map((p) => ({ ...p, status: "unsynced" as const })),
    ...reconciliation.inactive.map((p) => ({ ...p, status: "inactive" as const })),
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Plans" value={summary.totalPlans} sub={`${summary.activePlans} active`} />
        <StatCard
          label="Synced"
          value={summary.synced}
          sub={`of ${summary.activePlans} active`}
          variant={summary.synced === summary.activePlans ? "success" : "warning"}
        />
        <StatCard
          label="Broken"
          value={summary.broken}
          sub="Stripe price missing"
          variant={summary.broken > 0 ? "destructive" : "success"}
        />
        <StatCard
          label="Unsynced"
          value={summary.unsynced}
          sub="never pushed to Stripe"
          variant={summary.unsynced > 0 ? "destructive" : "success"}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" disabled={anyMutating} onClick={() => void refetch()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
        {canUpdate && (
          <>
            <Button size="sm" disabled={anyMutating} onClick={() => void syncAllMutation.mutateAsync(false)}>
              {syncAllMutation.isPending ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-3.5" />
              )}
              Sync Missing
            </Button>
            <Button variant="secondary" size="sm" disabled={anyMutating} onClick={() => void syncAllMutation.mutateAsync(true)}>
              {syncAllMutation.isPending ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-3.5" />
              )}
              Force Re-sync All
            </Button>
          </>
        )}
      </div>

      {/* All clear */}
      {!hasProblems && summary.inactive === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="size-8 text-green-600" />
              <p className="text-sm font-medium">All {summary.synced} plans synced to Stripe</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Every single plan in one table */}
      {(hasProblems || summary.inactive > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">All Plans ({allPlans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[1fr_100px_90px_80px_80px_100px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Plan</span>
                <span>Product</span>
                <span>Interval</span>
                <span>Price</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {allPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "grid grid-cols-[1fr_100px_90px_80px_80px_100px] items-center gap-2 border-b px-3 py-2 last:border-b-0",
                    plan.status === "inactive" && "opacity-50",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.moduleId} / {plan.tier}</p>
                  </div>
                  <Badge variant="outline" className="w-fit">{plan.productId}</Badge>
                  <span className="text-xs">{plan.billingInterval}</span>
                  <span className="text-sm">${parseFloat(plan.basePrice).toFixed(0)}</span>
                  <Badge
                    variant={
                      plan.status === "synced" ? "default" :
                      plan.status === "inactive" ? "secondary" :
                      "destructive"
                    }
                    className="w-fit text-xs"
                  >
                    {plan.status}
                  </Badge>
                  <div className="flex gap-1">
                    {canUpdate && plan.status !== "synced" && plan.status !== "inactive" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={anyMutating}
                        onClick={() => void syncSingleMutation.mutateAsync(plan.id)}
                      >
                        Sync
                      </Button>
                    )}
                    {canUpdate && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive hover:text-destructive"
                        disabled={anyMutating}
                        onClick={() => void deletePlansMutation.mutateAsync({ planIds: [plan.id], permanent: true })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: number;
  sub: string;
  variant?: "default" | "success" | "warning" | "destructive";
}): React.JSX.Element {
  const colorMap = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-amber-500",
    destructive: "text-destructive",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold", colorMap[variant])}>{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Base Module Pricing Section ──

function BaseModulePricingSection({
  baseMod,
  findPlan,
  editingTiers,
  canUpdate,
  isSaving,
  onStartEdit,
  onUpdateField,
  onSave,
  tierKey,
}: {
  baseMod: BaseModuleConfig;
  findPlan: (
    moduleId: string,
    tier: string,
    interval: string,
  ) => Plan | undefined;
  editingTiers: Record<string, TierPriceRow>;
  canUpdate: boolean;
  isSaving: boolean;
  onStartEdit: (
    moduleId: string,
    tierId: string,
    existing: Plan | undefined,
  ) => void;
  onUpdateField: (key: string, field: keyof TierPriceRow, value: string) => void;
  onSave: (tier: TierConfig) => void;
  tierKey: (moduleId: string, tierId: string) => string;
}): React.JSX.Element {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">
        {baseMod.fullName}
        {baseMod.required && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Always included
          </span>
        )}
      </h4>

      <div className="rounded-md border">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_50px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Tier</span>
          <span>Monthly price</span>
          <span>Included users</span>
          <span>Per extra user</span>
          <span />
        </div>

        {/* Tier rows */}
        {baseMod.tiers.map((tier) => {
          const key = tierKey(baseMod.id, tier.id);
          const existingPlan = findPlan(baseMod.id, tier.id, "monthly");
          const isEditing = key in editingTiers;
          const row = editingTiers[key];

          return (
            <div
              key={tier.id}
              className={cn(
                "grid grid-cols-[1fr_100px_80px_80px_50px] items-center gap-2 border-b px-3 py-2.5 last:border-b-0",
                isEditing && "bg-accent/30",
              )}
            >
              {/* Tier name */}
              <div>
                <p className="text-sm font-medium">{tier.label}</p>
                <p className="text-xs text-muted-foreground">
                  {tier.subtitle}
                </p>
              </div>

              {isEditing ? (
                <>
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      className="h-7 w-full text-sm"
                      placeholder="49"
                      value={row?.basePrice ?? ""}
                      onChange={(e) =>
                        onUpdateField(key, "basePrice", e.target.value)
                      }
                      autoFocus
                    />
                  </div>
                  <Input
                    className="h-7 w-full text-sm"
                    type="number"
                    min={0}
                    placeholder="5"
                    value={row?.includedUsers ?? ""}
                    onChange={(e) =>
                      onUpdateField(key, "includedUsers", e.target.value)
                    }
                  />
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      className="h-7 w-full text-sm"
                      placeholder="5"
                      value={row?.perUserPrice ?? ""}
                      onChange={(e) =>
                        onUpdateField(key, "perUserPrice", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSave(tier);
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-7 w-full"
                    disabled={!row?.basePrice || isSaving}
                    onClick={() => onSave(tier)}
                  >
                    {isSaving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                  </Button>
                </>
              ) : existingPlan ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-left hover:text-primary transition-colors"
                    onClick={() =>
                      canUpdate &&
                      onStartEdit(baseMod.id, tier.id, existingPlan)
                    }
                    disabled={!canUpdate}
                  >
                    ${parseFloat(existingPlan.basePrice).toFixed(0)}/mo
                    {existingPlan.stripePriceId && (
                      <Check className="size-3 text-green-600" />
                    )}
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {existingPlan.includedUsers}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {parseFloat(existingPlan.perUserPrice) > 0
                      ? `$${parseFloat(existingPlan.perUserPrice).toFixed(0)}/mo`
                      : "—"}
                  </span>
                  <span />
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={!canUpdate}
                    onClick={() =>
                      onStartEdit(baseMod.id, tier.id, undefined)
                    }
                  >
                    Set price
                  </Button>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
