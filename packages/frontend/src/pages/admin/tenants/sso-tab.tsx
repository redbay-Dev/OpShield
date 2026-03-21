import { useState, type FormEvent } from "react";
import { Loader2, Shield, Trash2, Plus } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@frontend/components/ui/dialog.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import {
  useSsoProviders,
  useUpsertSsoProvider,
  useDeleteSsoProvider,
} from "@frontend/hooks/use-sso-providers.js";
import { useAdminPermissions } from "@frontend/hooks/use-admin-permissions.js";

interface SsoTabProps {
  tenantId: string;
}

export function SsoTab({ tenantId }: SsoTabProps): React.JSX.Element {
  const { data: providers, isPending } = useSsoProviders(tenantId);
  const upsertMutation = useUpsertSsoProvider(tenantId);
  const deleteMutation = useDeleteSsoProvider(tenantId);
  const { canCreate, canDelete } = useAdminPermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("");
  const [enforced, setEnforced] = useState(false);
  const [error, setError] = useState("");

  const existingProvider = providers?.[0];

  function openDialog(): void {
    if (existingProvider) {
      setClientId(existingProvider.clientId);
      setClientSecret("");
      setAzureTenantId(existingProvider.tenantIdAzure ?? "");
      setEnforced(existingProvider.enforced);
    } else {
      setClientId("");
      setClientSecret("");
      setAzureTenantId("");
      setEnforced(false);
    }
    setError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    if (!clientId || !clientSecret || !azureTenantId) {
      setError("All fields are required");
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        provider: "microsoft",
        clientId,
        clientSecret,
        tenantIdAzure: azureTenantId,
        enforced,
      });
      setDialogOpen(false);
    } catch {
      setError("Failed to save SSO provider");
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SSO Configuration</h3>
          <p className="text-muted-foreground text-sm">
            Configure Microsoft Azure AD single sign-on for this tenant
          </p>
        </div>
        {canCreate && (
          <Button onClick={openDialog} size="sm">
            <Plus className="mr-1 h-3 w-3" />
            {existingProvider ? "Edit" : "Configure"} SSO
          </Button>
        )}
      </div>

      {!existingProvider ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              No SSO provider configured for this tenant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Microsoft Azure AD
              {existingProvider.enforced && (
                <Badge variant="default" className="text-xs">Enforced</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Client ID:</span>
                <p className="font-mono text-xs">{existingProvider.clientId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Azure Tenant ID:</span>
                <p className="font-mono text-xs">{existingProvider.tenantIdAzure}</p>
              </div>
              <div>
                <span className="text-muted-foreground">SSO Enforced:</span>
                <p>{existingProvider.enforced ? "Yes (email/password disabled)" : "No (optional)"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Configured:</span>
                <p>{new Date(existingProvider.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {canCreate && (
                <Button variant="outline" size="sm" onClick={openDialog}>
                  Edit Configuration
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => void deleteMutation.mutateAsync(existingProvider.id)}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3 w-3" />
                  )}
                  Remove SSO
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {existingProvider ? "Edit" : "Configure"} Microsoft SSO
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sso-client-id">Application (Client) ID</Label>
              <Input
                id="sso-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-client-secret">Client Secret</Label>
              <Input
                id="sso-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={existingProvider ? "Enter new secret to update" : "Client secret value"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-azure-tenant">Azure Tenant (Directory) ID</Label>
              <Input
                id="sso-azure-tenant"
                value={azureTenantId}
                onChange={(e) => setAzureTenantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sso-enforced"
                checked={enforced}
                onCheckedChange={(checked) => setEnforced(checked === true)}
              />
              <Label htmlFor="sso-enforced" className="text-sm font-normal">
                Enforce SSO (disable email/password login for this tenant)
              </Label>
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
