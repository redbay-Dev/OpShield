import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Loader2, Pencil, X, Check } from "lucide-react";
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
  useTenant,
  useUpdateTenant,
  useTenantEntitlements,
} from "@frontend/hooks/use-tenants.js";

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

export function TenantDetailPage(): React.JSX.Element {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data: tenant, isPending } = useTenant(tenantId ?? "");
  const updateTenant = useUpdateTenant(tenantId ?? "");
  const { data: entitlements } = useTenantEntitlements(tenantId ?? "");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBillingEmail, setEditBillingEmail] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [error, setError] = useState("");

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
        status: editStatus as "onboarding" | "active" | "suspended" | "cancelled",
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tenant");
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

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
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
              {error && (
                <div className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
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
            <CardHeader>
              <CardTitle>Module Entitlements</CardTitle>
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
                      <TableHead className="text-right">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entitlements?.modules.map((mod) => (
                      <TableRow key={`${mod.productId}-${mod.moduleId}`}>
                        <TableCell className="capitalize">
                          {mod.productId}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mod.moduleId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_VARIANT[mod.status] ?? "outline"
                            }
                          >
                            {mod.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {mod.currentUsers} / {mod.maxUsers}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
