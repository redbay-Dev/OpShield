import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Check,
  ShieldCheck,
  Truck,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Calendar,
  Trash2,
  Eraser,
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
    totalDbPlans: number;
    activePlans: number;
    syncedToStripe: number;
    missingStripePrice: number;
    missingPerUserPrice: number;
    priceMismatches: number;
    missingAnnualVariant: number;
    orphanedStripePrices: number;
    inactivePlans: number;
    totalStripePrices: number;
    totalStripeProducts: number;
  };
  synced: Array<Plan & Record<string, unknown>>;
  missingStripePrice: Array<Plan & { issue?: string }>;
  missingPerUserPrice: Array<Plan & Record<string, unknown>>;
  priceMismatches: Array<
    Plan & {
      stripeAmount: number;
      expectedAmount: number;
      stripeInterval: string;
      expectedInterval: string;
    }
  >;
  missingAnnualVariant: Array<Plan & Record<string, unknown>>;
  orphanedStripePrices: Array<{
    priceId: string;
    productId: string;
    unitAmount: number | null;
    currency: string;
    interval: string | null;
    nickname: string | null;
    productName: string;
  }>;
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

interface AnnualVariantResult {
  summary: {
    created: number;
    skipped: number;
  };
  created: Array<Record<string, unknown>>;
  skipped: Array<{ name: string; reason: string }>;
}

interface ClearStaleResult {
  clearedCount: number;
  totalPlans: number;
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
    mutationFn: async (): Promise<SyncAllResult> => {
      return apiPost<SyncAllResult>("/plans/admin/sync-all", {});
    },
    onSuccess: async (data) => {
      const { synced, failed, skipped } = data.summary;
      if (failed > 0) {
        toast.error(`Synced ${synced}, failed ${failed}, skipped ${skipped}`);
      } else if (synced > 0) {
        toast.success(`Synced ${synced} plans to Stripe (${skipped} already up-to-date)`);
      } else {
        toast.info("All plans already synced and verified in Stripe");
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

  const clearStaleMutation = useMutation({
    mutationFn: async (): Promise<ClearStaleResult> => {
      return apiPost<ClearStaleResult>("/plans/admin/clear-stale-stripe-ids", {});
    },
    onSuccess: async (data) => {
      if (data.clearedCount > 0) {
        toast.success(`Cleared ${data.clearedCount} stale Stripe references`);
      } else {
        toast.info("No stale Stripe references found");
      }
      await invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAnnualMutation = useMutation({
    mutationFn: async (): Promise<AnnualVariantResult> => {
      return apiPost<AnnualVariantResult>("/plans/admin/create-annual-variants", {});
    },
    onSuccess: async (data) => {
      const { created, skipped } = data.summary;
      if (created > 0) {
        toast.success(`Created ${created} annual plans`);
      } else {
        toast.info(`All ${skipped} annual plans already exist`);
      }
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
        toast.error(`${data.errors.length} plans could not be deleted: ${data.errors.map((e) => e.reason).join(", ")}`);
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
    const errMsg = error instanceof Error ? error.message : "Failed to load reconciliation data";
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
  const hasIssues =
    summary.missingStripePrice > 0 ||
    summary.missingPerUserPrice > 0 ||
    summary.priceMismatches > 0 ||
    summary.missingAnnualVariant > 0;

  const anyMutating =
    syncAllMutation.isPending ||
    syncSingleMutation.isPending ||
    clearStaleMutation.isPending ||
    createAnnualMutation.isPending ||
    deletePlansMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="DB Plans"
          value={summary.totalDbPlans}
          sub={`${summary.activePlans} active, ${summary.inactivePlans} inactive`}
        />
        <StatCard
          label="Synced"
          value={summary.syncedToStripe}
          sub={`of ${summary.activePlans} active`}
          variant={summary.syncedToStripe === summary.activePlans ? "success" : "warning"}
        />
        <StatCard
          label="Stripe Prices"
          value={summary.totalStripePrices}
          sub={`${summary.orphanedStripePrices} orphaned`}
          variant={summary.orphanedStripePrices > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Issues"
          value={
            summary.missingStripePrice +
            summary.missingPerUserPrice +
            summary.priceMismatches +
            summary.missingAnnualVariant
          }
          sub="need attention"
          variant={hasIssues ? "destructive" : "success"}
        />
      </div>

      {/* Action buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Actions</CardTitle>
          <CardDescription className="text-xs">
            Manage the connection between OpShield plans and Stripe prices. Sync pushes plans TO Stripe. Clear removes dead Stripe references FROM the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={anyMutating}
              onClick={() => void refetch()}
            >
              <RefreshCw className="mr-2 size-3.5" />
              Refresh
            </Button>

            {canUpdate && (
              <>
                <Button
                  size="sm"
                  disabled={anyMutating}
                  onClick={() => void syncAllMutation.mutateAsync()}
                >
                  {syncAllMutation.isPending ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-3.5" />
                  )}
                  Sync All to Stripe
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={anyMutating}
                  onClick={() => void clearStaleMutation.mutateAsync()}
                >
                  {clearStaleMutation.isPending ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <Eraser className="mr-2 size-3.5" />
                  )}
                  Clear Stale Stripe IDs
                </Button>

                {summary.missingAnnualVariant > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={anyMutating}
                    onClick={() => void createAnnualMutation.mutateAsync()}
                  >
                    {createAnnualMutation.isPending ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    ) : (
                      <Calendar className="mr-2 size-3.5" />
                    )}
                    Create Annual Variants ({summary.missingAnnualVariant})
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No issues */}
      {!hasIssues && summary.orphanedStripePrices === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="size-8 text-green-600" />
              <p className="text-sm font-medium">All plans are synced</p>
              <p className="text-xs text-muted-foreground">
                {summary.syncedToStripe} active plans verified against Stripe.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Stripe prices */}
      {reconciliation.missingStripePrice.length > 0 && (
        <IssueSection
          title="Missing Stripe Price"
          description="These plans have no valid Stripe price — they cannot be used in checkout. This includes plans whose Stripe price was deleted."
          icon={<XCircle className="size-4 text-destructive" />}
          count={reconciliation.missingStripePrice.length}
        >
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_100px_100px_80px_120px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Plan</span>
              <span>Product</span>
              <span>Interval</span>
              <span>Price</span>
              <span>Actions</span>
            </div>
            {reconciliation.missingStripePrice.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_100px_100px_80px_120px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.moduleId} / {plan.tier}
                    {plan.issue && (
                      <span className="ml-1 text-destructive">(stale ref)</span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">{plan.productId}</Badge>
                <Badge variant="secondary" className="w-fit">{plan.billingInterval}</Badge>
                <span className="text-sm">${parseFloat(plan.basePrice).toFixed(0)}</span>
                {canUpdate ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={anyMutating}
                      onClick={() => void syncSingleMutation.mutateAsync(plan.id)}
                    >
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive hover:text-destructive"
                      disabled={anyMutating}
                      onClick={() => void deletePlansMutation.mutateAsync({ planIds: [plan.id], permanent: true })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Read-only</span>
                )}
              </div>
            ))}
          </div>
        </IssueSection>
      )}

      {/* Missing per-user prices */}
      {reconciliation.missingPerUserPrice.length > 0 && (
        <IssueSection
          title="Missing Per-User Price"
          description="These plans have per-user pricing but no Stripe per-user price ID."
          icon={<AlertTriangle className="size-4 text-amber-500" />}
          count={reconciliation.missingPerUserPrice.length}
        >
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Plan</span>
              <span>Product</span>
              <span>Per User</span>
              <span>Interval</span>
              <span>Action</span>
            </div>
            {reconciliation.missingPerUserPrice.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_100px_100px_80px_80px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.moduleId} / {plan.tier}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">{plan.productId}</Badge>
                <span className="text-sm">${parseFloat(plan.perUserPrice).toFixed(0)}/user</span>
                <Badge variant="secondary" className="w-fit">{plan.billingInterval}</Badge>
                {canUpdate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={anyMutating}
                    onClick={() => void syncSingleMutation.mutateAsync(plan.id)}
                  >
                    Sync
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Read-only</span>
                )}
              </div>
            ))}
          </div>
        </IssueSection>
      )}

      {/* Price mismatches */}
      {reconciliation.priceMismatches.length > 0 && (
        <IssueSection
          title="Price Mismatches"
          description="These plans have Stripe prices that don't match the database. Re-syncing will create new Stripe prices."
          icon={<AlertTriangle className="size-4 text-amber-500" />}
          count={reconciliation.priceMismatches.length}
        >
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_120px_120px_80px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Plan</span>
              <span>DB Amount (cents)</span>
              <span>Stripe Amount (cents)</span>
              <span>Action</span>
            </div>
            {reconciliation.priceMismatches.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_120px_120px_80px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.moduleId} / {plan.tier} ({plan.billingInterval})
                  </p>
                </div>
                <span className="text-sm font-mono">{plan.expectedAmount}</span>
                <span className="text-sm font-mono text-destructive">{plan.stripeAmount}</span>
                {canUpdate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={anyMutating}
                    onClick={() => void syncSingleMutation.mutateAsync(plan.id)}
                  >
                    Re-sync
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Read-only</span>
                )}
              </div>
            ))}
          </div>
        </IssueSection>
      )}

      {/* Missing annual variants */}
      {reconciliation.missingAnnualVariant.length > 0 && (
        <IssueSection
          title="Missing Annual Variants"
          description="These monthly plans don't have a corresponding annual plan. Annual billing won't be available for them."
          icon={<Calendar className="size-4 text-amber-500" />}
          count={reconciliation.missingAnnualVariant.length}
        >
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_100px_100px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Plan</span>
              <span>Product</span>
              <span>Monthly Price</span>
            </div>
            {reconciliation.missingAnnualVariant.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_100px_100px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.moduleId} / {plan.tier}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">{plan.productId}</Badge>
                <span className="text-sm">${parseFloat(plan.basePrice).toFixed(0)}/mo</span>
              </div>
            ))}
          </div>
        </IssueSection>
      )}

      {/* Orphaned Stripe prices */}
      {reconciliation.orphanedStripePrices.length > 0 && (
        <IssueSection
          title="Orphaned Stripe Prices"
          description="These active Stripe prices are not referenced by any plan in the database. Archive them in the Stripe dashboard if not needed."
          icon={<AlertTriangle className="size-4 text-amber-500" />}
          count={reconciliation.orphanedStripePrices.length}
        >
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_140px_100px_100px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Stripe Product</span>
              <span>Price ID</span>
              <span>Amount</span>
              <span>Interval</span>
            </div>
            {reconciliation.orphanedStripePrices.map((price) => (
              <div
                key={price.priceId}
                className="grid grid-cols-[1fr_140px_100px_100px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{price.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {price.nickname ?? price.priceId}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {price.priceId}
                </span>
                <span className="text-sm">
                  {price.unitAmount !== null
                    ? `$${(price.unitAmount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
                    : "—"}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {price.interval ?? "one-time"}
                </Badge>
              </div>
            ))}
          </div>
        </IssueSection>
      )}

      {/* Inactive plans */}
      {reconciliation.inactive.length > 0 && (
        <IssueSection
          title="Inactive Plans"
          description="These plans are deactivated and won't appear in the pricing page or checkout."
          icon={<XCircle className="size-4 text-muted-foreground" />}
          count={reconciliation.inactive.length}
          defaultCollapsed
        >
          {canUpdate && (
            <div className="mb-3">
              <Button
                variant="destructive"
                size="sm"
                disabled={anyMutating}
                onClick={() => {
                  const ids = reconciliation.inactive.map((p) => p.id);
                  void deletePlansMutation.mutateAsync({ planIds: ids, permanent: true });
                }}
              >
                {deletePlansMutation.isPending ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-3.5" />
                )}
                Delete All Inactive ({reconciliation.inactive.length})
              </Button>
            </div>
          )}
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_100px_100px_80px_60px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Plan</span>
              <span>Product</span>
              <span>Interval</span>
              <span>Price</span>
              <span />
            </div>
            {reconciliation.inactive.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_100px_100px_80px_60px] items-center gap-2 border-b px-3 py-2 last:border-b-0 opacity-60"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.moduleId} / {plan.tier}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">{plan.productId}</Badge>
                <Badge variant="secondary" className="w-fit">{plan.billingInterval}</Badge>
                <span className="text-sm">${parseFloat(plan.basePrice).toFixed(0)}</span>
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
            ))}
          </div>
        </IssueSection>
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

// ── Issue Section ──

function IssueSection({
  title,
  description,
  icon,
  count,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex items-center gap-3 text-left w-full"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {icon}
          <div className="flex-1">
            <CardTitle className="text-sm">
              {title}
              <Badge variant="secondary" className="ml-2 text-xs">
                {count}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">
            {collapsed ? "Show" : "Hide"}
          </span>
        </button>
      </CardHeader>
      {!collapsed && <CardContent className="pt-0">{children}</CardContent>}
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
