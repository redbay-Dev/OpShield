import { useState, type FormEvent } from "react";
import { Loader2, RefreshCw, Play, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@frontend/components/ui/dialog.js";
import {
  useProvisioningStatus,
  useProvisionTenant,
  useRetryProvisioning,
  useResetProvisioning,
} from "@frontend/hooks/use-tenants.js";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  dispatched: "secondary",
  success: "default",
  failed: "destructive",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  dispatched: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
};

const PRODUCT_LABELS: Record<string, string> = {
  nexum: "Nexum",
  safespec: "SafeSpec",
};

interface ProvisioningTabProps {
  tenantId: string;
}

export function ProvisioningTab({ tenantId }: ProvisioningTabProps): React.JSX.Element {
  const { data: statuses, isPending } = useProvisioningStatus(tenantId, {
    pollWhileDispatched: true,
  });
  const provisionMutation = useProvisionTenant(tenantId);
  const retryMutation = useRetryProvisioning(tenantId);
  const resetMutation = useResetProvisioning(tenantId);

  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [error, setError] = useState("");

  async function handleProvision(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    try {
      await provisionMutation.mutateAsync({
        ownerUserId: ownerUserId || undefined,
        ownerEmail: ownerEmail || undefined,
        ownerName: ownerName || undefined,
      });
      setProvisionDialogOpen(false);
      setOwnerEmail("");
      setOwnerName("");
      setOwnerUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provisioning failed");
    }
  }

  async function handleRetry(productId: "safespec" | "nexum"): Promise<void> {
    setError("");
    try {
      await retryMutation.mutateAsync({ productId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  async function handleReset(productId: string): Promise<void> {
    setError("");
    try {
      await resetMutation.mutateAsync(productId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Provisioning Status</CardTitle>
            <CardDescription>
              Schema provisioning status for each product backend
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs">
              {tenantId}
            </code>
            <Button size="sm" onClick={() => setProvisionDialogOpen(true)}>
              <Play className="mr-2 h-3 w-3" />
              Provision
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!statuses || statuses.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No provisioning records yet. Add modules and trigger provisioning.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {statuses.map((row) => (
                <Card key={row.id} className="border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {PRODUCT_LABELS[row.productId] ?? row.productId}
                      </h3>
                      <Badge
                        variant={STATUS_VARIANT[row.status] ?? "outline"}
                        className="flex items-center gap-1"
                      >
                        {STATUS_ICON[row.status]}
                        {row.status}
                      </Badge>
                    </div>

                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Attempts</dt>
                        <dd className="font-mono">{row.attempts}</dd>
                      </div>
                      {row.provisionedAt && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Provisioned</dt>
                          <dd>{new Date(row.provisionedAt).toLocaleString()}</dd>
                        </div>
                      )}
                      {row.lastError && (
                        <div>
                          <dt className="text-muted-foreground mb-1">Last Error</dt>
                          <dd className="bg-destructive/5 text-destructive rounded p-2 font-mono text-xs">
                            {row.lastError}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Updated</dt>
                        <dd>{new Date(row.updatedAt).toLocaleString()}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex gap-2">
                      {row.status !== "success" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={retryMutation.isPending}
                          onClick={() =>
                            void handleRetry(row.productId as "safespec" | "nexum")
                          }
                        >
                          {retryMutation.isPending ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-3 w-3" />
                          )}
                          {row.status === "dispatched" ? "Re-provision" : "Retry"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={resetMutation.isPending}
                        onClick={() => void handleReset(row.productId)}
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provision Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleProvision(e)} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This will send <code>tenant.created</code> webhooks to each product
              that has modules assigned. Optionally provide owner info for the
              initial admin user.
            </p>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Owner Email</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-name">Owner Name</Label>
              <Input
                id="owner-name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-user-id">Owner User ID</Label>
              <Input
                id="owner-user-id"
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                placeholder="Optional — OpShield user ID"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProvisionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={provisionMutation.isPending}>
                {provisionMutation.isPending && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                Provision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
