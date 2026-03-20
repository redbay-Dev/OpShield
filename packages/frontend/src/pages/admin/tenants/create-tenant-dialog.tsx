import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/components/ui/dialog.js";
import { useCreateTenant } from "@frontend/hooks/use-tenants.js";

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateTenantDialog({
  open,
  onOpenChange,
}: CreateTenantDialogProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const createTenant = useCreateTenant();

  function handleNameChange(value: string): void {
    setName(value);
    if (!slugManual) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string): void {
    setSlugManual(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    try {
      const tenant = await createTenant.mutateAsync({
        name,
        slug,
        billingEmail,
      });
      onOpenChange(false);
      setName("");
      setSlug("");
      setSlugManual(false);
      setBillingEmail("");
      void navigate(`/admin/tenants/${tenant.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>
            Register a new tenant on the platform
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Company Name</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Transport"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-transport"
                required
                minLength={2}
                pattern="[a-z0-9-]+"
              />
              <p className="text-muted-foreground text-xs">
                Used in URLs and API identifiers
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-email">Billing Email</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="billing@acme.com.au"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              {createTenant.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
