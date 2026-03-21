import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  X,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/components/ui/tabs.js";
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
} from "@frontend/components/ui/dialog.js";
import {
  useTenant,
  useUpdateTenant,
  useTenantEntitlements,
  useAddModule,
  useUpdateModule,
  useRemoveModule,
} from "@frontend/hooks/use-tenants.js";
import {
  SAFESPEC_MODULES,
  NEXUM_MODULES,
} from "@opshield/shared/constants";
import { BillingTab } from "./billing-tab.js";
import { ProvisioningTab } from "./provisioning-tab.js";
import { SsoTab } from "./sso-tab.js";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  onboarding: "secondary",
  suspended: "destructive",
  cancelled: "outline",
  trial: "secondary",
};

/** Friendly display names for module IDs */
const MODULE_LABELS: Record<string, string> = {
  "safespec-whs": "WHS (Work Health & Safety)",
  "safespec-hva": "HVA (Heavy Vehicle Accreditation)",
  "safespec-fleet-maintenance": "Fleet Maintenance",
  "nexum-core": "Core",
  "nexum-invoicing": "Invoicing",
  "nexum-rcti": "RCTI",
  "nexum-xero": "Xero Integration",
  "nexum-compliance": "Compliance",
  "nexum-sms": "SMS",
  "nexum-dockets": "Docket Processing",
  "nexum-materials": "Materials",
  "nexum-map-planning": "Map Planning",
  "nexum-ai": "AI Automation",
  "nexum-reporting": "Reporting",
  "nexum-portal": "Portal",
};

/** All available modules grouped by product */
const AVAILABLE_MODULES = [
  {
    product: "safespec" as const,
    label: "SafeSpec",
    modules: Object.values(SAFESPEC_MODULES),
  },
  {
    product: "nexum" as const,
    label: "Nexum",
    modules: Object.values(NEXUM_MODULES),
  },
];

export function TenantDetailPage(): React.JSX.Element {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data: tenant, isPending } = useTenant(tenantId ?? "");
  const updateTenant = useUpdateTenant(tenantId ?? "");
  const { data: entitlements } = useTenantEntitlements(tenantId ?? "");
  const addModuleMutation = useAddModule(tenantId ?? "");
  const updateModuleMutation = useUpdateModule(tenantId ?? "");
  const removeModuleMutation = useRemoveModule(tenantId ?? "");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBillingEmail, setEditBillingEmail] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [error, setError] = useState("");

  // Add module dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<
    "safespec" | "nexum"
  >("safespec");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [moduleMaxUsers, setModuleMaxUsers] = useState("5");
  const [moduleStatus, setModuleStatus] = useState<"active" | "trial">(
    "active",
  );
  const [moduleError, setModuleError] = useState("");

  // Track which module is being status-edited
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleStatus, setEditModuleStatus] = useState("");

  function startEditing(): void {
    if (!tenant) return;
    setEditName(tenant.name);
    setEditBillingEmail(tenant.billingEmail ?? "");
    setEditStatus(tenant.status);
    setEditing(true);
    setError("");
  }

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    try {
      await updateTenant.mutateAsync({
        name: editName,
        billingEmail: editBillingEmail,
        status: editStatus as
          | "onboarding"
          | "active"
          | "suspended"
          | "cancelled",
      });
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update tenant",
      );
    }
  }

  // Get assigned module IDs to filter available modules
  const assignedModuleIds = new Set(
    entitlements?.modules.map((m) => m.moduleId) ?? [],
  );

  async function handleAddModule(e: FormEvent): Promise<void> {
    e.preventDefault();
    setModuleError("");

    if (!selectedModuleId) {
      setModuleError("Select a module");
      return;
    }

    try {
      await addModuleMutation.mutateAsync({
        productId: selectedProduct,
        moduleId: selectedModuleId,
        maxUsers: Number(moduleMaxUsers),
        status: moduleStatus,
      });
      setAddDialogOpen(false);
      setSelectedModuleId("");
      setModuleMaxUsers("5");
      setModuleStatus("active");
    } catch (err) {
      setModuleError(
        err instanceof Error ? err.message : "Failed to add module",
      );
    }
  }

  async function handleRemoveModule(moduleId: string): Promise<void> {
    try {
      await removeModuleMutation.mutateAsync(moduleId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove module",
      );
    }
  }

  async function handleUpdateModuleStatus(moduleId: string): Promise<void> {
    try {
      await updateModuleMutation.mutateAsync({
        moduleId,
        data: {
          status: editModuleStatus as
            | "active"
            | "trial"
            | "suspended"
            | "cancelled",
        },
      });
      setEditingModuleId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update module status",
      );
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Tenant not found</p>
        <Link to="/admin/tenants" className="text-primary text-sm underline">
          Back to tenants
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/tenants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {tenant.slug}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[tenant.status] ?? "outline"}>
          {tenant.status}
        </Badge>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="modules">
            Modules
            {entitlements?.modules.length
              ? ` (${String(entitlements.modules.length)})`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="provisioning">Provisioning</TabsTrigger>
          <TabsTrigger value="sso">SSO</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tenant Details</CardTitle>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="mr-2 h-3 w-3" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <form
                  onSubmit={(e) => void handleSave(e)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Billing Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editBillingEmail}
                      onChange={(e) => setEditBillingEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <select
                      id="edit-status"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="onboarding">Onboarding</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateTenant.isPending}
                    >
                      {updateTenant.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-3 w-3" />
                      )}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      <X className="mr-2 h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-sm">Name</dt>
                    <dd className="font-medium">{tenant.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Slug</dt>
                    <dd className="font-mono">{tenant.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">
                      Billing Email
                    </dt>
                    <dd>{tenant.billingEmail ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">
                      Stripe Customer
                    </dt>
                    <dd className="font-mono text-sm">
                      {tenant.stripeCustomerId ?? "Not connected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Created</dt>
                    <dd>{new Date(tenant.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Updated</dt>
                    <dd>{new Date(tenant.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Module Entitlements</CardTitle>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-3 w-3" />
                Add Module
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Module</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => void handleAddModule(e)}
                    className="space-y-4"
                  >
                    {moduleError && (
                      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                        {moduleError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <select
                        value={selectedProduct}
                        onChange={(e) => {
                          setSelectedProduct(
                            e.target.value as "safespec" | "nexum",
                          );
                          setSelectedModuleId("");
                        }}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      >
                        {AVAILABLE_MODULES.map((g) => (
                          <option key={g.product} value={g.product}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Module</Label>
                      <select
                        value={selectedModuleId}
                        onChange={(e) => setSelectedModuleId(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="">Select a module...</option>
                        {AVAILABLE_MODULES.find(
                          (g) => g.product === selectedProduct,
                        )?.modules
                          .filter((m) => !assignedModuleIds.has(m))
                          .map((m) => (
                            <option key={m} value={m}>
                              {MODULE_LABELS[m] ?? m}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-users">Max Users</Label>
                        <Input
                          id="max-users"
                          type="number"
                          min="1"
                          value={moduleMaxUsers}
                          onChange={(e) => setModuleMaxUsers(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                          value={moduleStatus}
                          onChange={(e) =>
                            setModuleStatus(
                              e.target.value as "active" | "trial",
                            )
                          }
                          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="trial">Trial</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={addModuleMutation.isPending}
                      >
                        {addModuleMutation.isPending && (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        )}
                        Add Module
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {entitlements?.modules.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No modules assigned to this tenant
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entitlements?.modules.map((mod) => (
                      <TableRow key={`${mod.productId}-${mod.moduleId}`}>
                        <TableCell className="capitalize">
                          {mod.productId}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {MODULE_LABELS[mod.moduleId] ?? mod.moduleId}
                          </span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">
                            {mod.moduleId}
                          </span>
                        </TableCell>
                        <TableCell>
                          {editingModuleId === mod.moduleId ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={editModuleStatus}
                                onChange={(e) =>
                                  setEditModuleStatus(e.target.value)
                                }
                                className="border-input bg-background rounded border px-2 py-1 text-xs"
                              >
                                <option value="active">Active</option>
                                <option value="trial">Trial</option>
                                <option value="suspended">Suspended</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={updateModuleMutation.isPending}
                                onClick={() =>
                                  void handleUpdateModuleStatus(mod.moduleId)
                                }
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setEditingModuleId(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              variant={
                                STATUS_VARIANT[mod.status] ?? "outline"
                              }
                              className="cursor-pointer"
                              onClick={() => {
                                setEditingModuleId(mod.moduleId);
                                setEditModuleStatus(mod.status);
                              }}
                            >
                              {mod.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {mod.plan ? (
                            <span className="text-muted-foreground text-sm capitalize">
                              {mod.plan.tier} — ${mod.plan.basePrice}/mo
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {mod.currentUsers} / {mod.maxUsers}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            disabled={removeModuleMutation.isPending}
                            onClick={() =>
                              void handleRemoveModule(mod.moduleId)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab tenantId={tenantId ?? ""} />
        </TabsContent>

        <TabsContent value="provisioning">
          <ProvisioningTab tenantId={tenantId ?? ""} />
        </TabsContent>
        <TabsContent value="sso">
          <SsoTab tenantId={tenantId ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
