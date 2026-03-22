import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Power,
  PowerOff,
  DollarSign,
  Users,
  Package,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/components/ui/dialog.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@frontend/api/client.js";
import { useAdminPermissions } from "@frontend/hooks/use-admin-permissions.js";

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

/** Per-module pricing entry in the create form */
interface ModulePricing {
  moduleId: string;
  basePrice: string;
  perUserPrice: string;
  includedUsers: number;
}

interface EditFormData {
  name: string;
  basePrice: string;
  includedUsers: number;
  perUserPrice: string;
  features: string;
}

// ── Constants ──

interface ModuleOption {
  value: string;
  label: string;
  product: string;
}

const SAFESPEC_MODULES: ModuleOption[] = [
  { value: "safespec-whs", label: "WHS Module", product: "safespec" },
  { value: "safespec-hva", label: "HVA Compliance", product: "safespec" },
  { value: "safespec-fleet-maintenance", label: "Fleet Maintenance", product: "safespec" },
];

const NEXUM_MODULES: ModuleOption[] = [
  { value: "nexum-core", label: "Nexum Core", product: "nexum" },
  { value: "nexum-invoicing", label: "Invoicing", product: "nexum" },
  { value: "nexum-rcti", label: "RCTI", product: "nexum" },
  { value: "nexum-xero", label: "Xero Integration", product: "nexum" },
  { value: "nexum-compliance", label: "Compliance", product: "nexum" },
  { value: "nexum-sms", label: "SMS Messaging", product: "nexum" },
  { value: "nexum-dockets", label: "Docket Processing", product: "nexum" },
  { value: "nexum-materials", label: "Materials", product: "nexum" },
  { value: "nexum-map-planning", label: "Map Planning", product: "nexum" },
  { value: "nexum-ai", label: "AI Automation", product: "nexum" },
  { value: "nexum-reporting", label: "Reporting & Analytics", product: "nexum" },
  { value: "nexum-portal", label: "Portal", product: "nexum" },
];

const ALL_MODULE_OPTIONS = [...SAFESPEC_MODULES, ...NEXUM_MODULES];

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_MODULE_OPTIONS.map((m) => [m.value, m.label]),
);

const MODULE_PRODUCT: Record<string, string> = Object.fromEntries(
  ALL_MODULE_OPTIONS.map((m) => [m.value, m.product]),
);

const PRODUCT_LABELS: Record<string, string> = {
  safespec: "SafeSpec",
  nexum: "Nexum",
};

/** Ensure price string matches XX.XX format required by backend */
function formatDecimal(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

// ── Component ──

export function PlansPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = useAdminPermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createTier, setCreateTier] = useState("");
  const [createInterval, setCreateInterval] = useState("monthly");
  const [createFeatures, setCreateFeatures] = useState("");
  const [modulePricings, setModulePricings] = useState<ModulePricing[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState<EditFormData>({
    name: "", basePrice: "", includedUsers: 5, perUserPrice: "0.00", features: "",
  });

  const [filterProduct, setFilterProduct] = useState<string>("all");

  // ── Queries ──

  const { data: plans, isPending } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async (): Promise<Plan[]> => {
      return apiGet<Plan[]>("/plans/admin");
    },
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const features = createFeatures
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      for (const mp of modulePricings) {
        const productId = MODULE_PRODUCT[mp.moduleId];
        if (!productId) continue;

        await apiPost("/plans", {
          name: createName,
          productId,
          moduleId: mp.moduleId,
          tier: createTier,
          basePrice: formatDecimal(mp.basePrice),
          includedUsers: mp.includedUsers,
          perUserPrice: formatDecimal(mp.perUserPrice),
          billingInterval: createInterval,
          features,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(`Created ${modulePricings.length} plan${modulePricings.length > 1 ? "s" : ""}`);
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      planId,
      data,
    }: {
      planId: string;
      data: EditFormData;
    }): Promise<void> => {
      await apiPatch(`/plans/${planId}`, {
        name: data.name,
        basePrice: formatDecimal(data.basePrice),
        includedUsers: data.includedUsers,
        perUserPrice: formatDecimal(data.perUserPrice),
        features: data.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      planId,
      activate,
    }: {
      planId: string;
      activate: boolean;
    }): Promise<void> => {
      if (activate) {
        await apiPatch(`/plans/${planId}`, { isActive: "true" });
      } else {
        await apiDelete(`/plans/${planId}`);
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(variables.activate ? "Plan reactivated" : "Plan deactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (planId: string): Promise<void> => {
      await apiDelete(`/plans/${planId}/permanent`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan permanently deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Handlers ──

  function closeDialog(): void {
    setDialogOpen(false);
    setEditingPlan(null);
    setCreateName("");
    setCreateTier("");
    setCreateInterval("monthly");
    setCreateFeatures("");
    setModulePricings([]);
    setEditForm({ name: "", basePrice: "", includedUsers: 5, perUserPrice: "0.00", features: "" });
  }

  function openCreate(): void {
    setEditingPlan(null);
    setCreateName("");
    setCreateTier("");
    setCreateInterval("monthly");
    setCreateFeatures("");
    setModulePricings([]);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan): void {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      basePrice: plan.basePrice,
      includedUsers: plan.includedUsers,
      perUserPrice: plan.perUserPrice,
      features: (plan.features ?? []).join("\n"),
    });
    setDialogOpen(true);
  }

  function toggleModule(moduleId: string): void {
    setModulePricings((prev) => {
      const exists = prev.find((m) => m.moduleId === moduleId);
      if (exists) {
        return prev.filter((m) => m.moduleId !== moduleId);
      }
      return [...prev, { moduleId, basePrice: "", perUserPrice: "0.00", includedUsers: 5 }];
    });
  }

  function updateModulePricing(moduleId: string, field: keyof ModulePricing, value: string | number): void {
    setModulePricings((prev) =>
      prev.map((m) =>
        m.moduleId === moduleId ? { ...m, [field]: value } : m,
      ),
    );
  }

  function handleSubmit(): void {
    if (editingPlan) {
      void updateMutation.mutate({ planId: editingPlan.id, data: editForm });
    } else {
      void createMutation.mutate();
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isCreateValid =
    createName &&
    createTier &&
    modulePricings.length > 0 &&
    modulePricings.every((m) => m.basePrice);
  const isEditValid = editForm.name && editForm.basePrice;
  const isFormValid = editingPlan ? isEditValid : isCreateValid;

  // ── Filter ──

  const filteredPlans =
    filterProduct === "all"
      ? plans
      : plans?.filter((p) => p.productId === filterProduct);

  const activePlans = filteredPlans?.filter((p) => p.isActive === "true") ?? [];
  const inactivePlans =
    filteredPlans?.filter((p) => p.isActive !== "true") ?? [];

  // ── Render ──

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Plans</h1>
          <p className="text-muted-foreground">
            Manage pricing plans for all products and modules.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Plans
          </Button>
        )}
      </div>


      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans?.filter((p) => p.isActive === "true").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Covered</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(plans?.map((p) => p.productId)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Filter by product:</Label>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="safespec">SafeSpec</SelectItem>
            <SelectItem value="nexum">Nexum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Active Plans ({activePlans.length})
          </CardTitle>
          <CardDescription>
            Plans currently available for purchase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activePlans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active plans. Create one to enable the sign-up flow.
            </p>
          ) : (
            <PlanTable
              plans={activePlans}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={openEdit}
              onToggleActive={(planId) =>
                void toggleActiveMutation.mutate({ planId, activate: false })
              }
              isActive
            />
          )}
        </CardContent>
      </Card>

      {/* Inactive Plans */}
      {inactivePlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Inactive Plans ({inactivePlans.length})
            </CardTitle>
            <CardDescription>
              Deactivated plans. Existing subscriptions still reference these.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanTable
              plans={inactivePlans}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={openEdit}
              onToggleActive={(planId) =>
                void toggleActiveMutation.mutate({ planId, activate: true })
              }
              onPermanentDelete={(planId) =>
                void permanentDeleteMutation.mutate(planId)
              }
              isActive={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className={editingPlan ? "sm:max-w-lg" : "sm:max-w-2xl max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create Plans"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Update pricing and features."
                : "Select modules and set individual pricing for each."}
            </DialogDescription>
          </DialogHeader>

          {editingPlan ? (
            /* ── Edit Form ── */
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Plan Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-base">Base Price ($/mo)</Label>
                  <Input
                    id="edit-base"
                    placeholder="49.00"
                    value={editForm.basePrice}
                    onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-per-user">Per User ($)</Label>
                  <Input
                    id="edit-per-user"
                    placeholder="5.00"
                    value={editForm.perUserPrice}
                    onChange={(e) => setEditForm({ ...editForm, perUserPrice: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-users">Included Users</Label>
                  <Input
                    id="edit-users"
                    type="number"
                    min={0}
                    value={editForm.includedUsers}
                    onChange={(e) => setEditForm({ ...editForm, includedUsers: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-features">Features (one per line)</Label>
                <textarea
                  id="edit-features"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  value={editForm.features}
                  onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
                />
              </div>
            </div>
          ) : (
            /* ── Create Form ── */
            <div className="grid gap-4 py-2">
              {/* Shared fields: name, tier, interval */}
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">Plan Name</Label>
                  <Input
                    id="create-name"
                    placeholder="e.g. Starter"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-tier">Tier</Label>
                  <Input
                    id="create-tier"
                    placeholder="e.g. starter"
                    value={createTier}
                    onChange={(e) => setCreateTier(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Billing Interval</Label>
                  <Select value={createInterval} onValueChange={setCreateInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Module selection */}
              <div className="grid gap-2">
                <Label>Modules &amp; Pricing</Label>
                <div className="rounded-md border">
                  {/* Module checkboxes */}
                  <div className="border-b p-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">SafeSpec</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {SAFESPEC_MODULES.map((mod) => (
                          <label key={mod.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={modulePricings.some((m) => m.moduleId === mod.value)}
                              onCheckedChange={() => toggleModule(mod.value)}
                            />
                            {mod.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Nexum</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {NEXUM_MODULES.map((mod) => (
                          <label key={mod.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={modulePricings.some((m) => m.moduleId === mod.value)}
                              onCheckedChange={() => toggleModule(mod.value)}
                            />
                            {mod.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Per-module pricing table */}
                  {modulePricings.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          <TableHead>Base Price ($/mo)</TableHead>
                          <TableHead>Per User ($)</TableHead>
                          <TableHead>Included Users</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modulePricings.map((mp) => (
                          <TableRow key={mp.moduleId}>
                            <TableCell className="text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {PRODUCT_LABELS[MODULE_PRODUCT[mp.moduleId] ?? ""] ?? ""}
                                </Badge>
                                {MODULE_LABELS[mp.moduleId] ?? mp.moduleId}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                placeholder="49.00"
                                value={mp.basePrice}
                                onChange={(e) => updateModulePricing(mp.moduleId, "basePrice", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-20"
                                placeholder="5.00"
                                value={mp.perUserPrice}
                                onChange={(e) => updateModulePricing(mp.moduleId, "perUserPrice", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-16"
                                type="number"
                                min={0}
                                value={mp.includedUsers}
                                onChange={(e) => updateModulePricing(mp.moduleId, "includedUsers", parseInt(e.target.value, 10) || 0)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleModule(mp.moduleId)}
                              >
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {modulePricings.length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Select modules above to set pricing.
                    </p>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="grid gap-2">
                <Label htmlFor="create-features">Features (one per line, shared across all plans)</Label>
                <textarea
                  id="create-features"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={"Unlimited inspections\nEmail support"}
                  value={createFeatures}
                  onChange={(e) => setCreateFeatures(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingPlan
                ? "Save Changes"
                : modulePricings.length > 1
                  ? `Create ${modulePricings.length} Plans`
                  : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Plan Table Sub-component ──

function PlanTable({
  plans,
  canUpdate,
  canDelete,
  onEdit,
  onToggleActive,
  onPermanentDelete,
  isActive,
}: {
  plans: Plan[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (plan: Plan) => void;
  onToggleActive: (planId: string) => void;
  onPermanentDelete?: (planId: string) => void;
  isActive: boolean;
}): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="text-right">Base Price</TableHead>
          <TableHead className="text-right">Per User</TableHead>
          <TableHead className="text-right">Included</TableHead>
          <TableHead>Interval</TableHead>
          <TableHead>Stripe</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.id}>
            <TableCell className="font-medium">{plan.name}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {PRODUCT_LABELS[plan.productId] ?? plan.productId}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {MODULE_LABELS[plan.moduleId] ?? plan.moduleId}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{plan.tier}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              ${plan.basePrice}
            </TableCell>
            <TableCell className="text-right font-mono">
              ${plan.perUserPrice}
            </TableCell>
            <TableCell className="text-right">{plan.includedUsers}</TableCell>
            <TableCell className="text-sm capitalize">
              {plan.billingInterval}
            </TableCell>
            <TableCell>
              {plan.stripePriceId ? (
                <Badge variant="default" className="text-xs">
                  Linked
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Not linked
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(plan)}
                    title="Edit plan"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {(isActive ? canDelete : canUpdate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleActive(plan.id)}
                    title={isActive ? "Deactivate plan" : "Reactivate plan"}
                  >
                    {isActive ? (
                      <PowerOff className="h-4 w-4 text-destructive" />
                    ) : (
                      <Power className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                )}
                {!isActive && canDelete && onPermanentDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPermanentDelete(plan.id)}
                    title="Permanently delete plan"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
