import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Check,
  ShieldCheck,
  Truck,
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
import { Separator } from "@frontend/components/ui/separator.js";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "@frontend/api/client.js";
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

      {/* Product sections */}
      {PRODUCT_IDS.map((productId) => {
        const config = PRODUCT_CONFIG[productId];
        const Icon = ICON_MAP[config.icon];

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
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {config.tagline}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Base modules with tiers */}
              {config.baseModules.map((baseMod) => (
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
              {config.addons.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                      Add-ons
                    </h4>
                    <div className="space-y-2">
                      {config.addons.map((addon) => {
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
    </div>
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
