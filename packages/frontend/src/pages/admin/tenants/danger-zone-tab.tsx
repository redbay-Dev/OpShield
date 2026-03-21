import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
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
import {
  useSuspendTenant,
  useCancelTenantSubscription,
  useScheduleTenantDeletion,
} from "@frontend/hooks/use-tenants.js";
import { useAdminPermissions } from "@frontend/hooks/use-admin-permissions.js";

interface DangerZoneTabProps {
  tenantId: string;
  tenantSlug: string;
  tenantStatus: string;
}

export function DangerZoneTab({
  tenantId,
  tenantSlug,
  tenantStatus,
}: DangerZoneTabProps): React.JSX.Element {
  const { canUpdate, canDelete } = useAdminPermissions();

  // Suspend
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const suspendMutation = useSuspendTenant(tenantId);

  // Cancel subscription
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelMutation = useCancelTenantSubscription(tenantId);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");
  const deleteMutation = useScheduleTenantDeletion(tenantId);

  function handleSuspend(): void {
    suspendMutation.mutate(
      { reason: suspendReason },
      {
        onSuccess: () => {
          setSuspendOpen(false);
          setSuspendReason("");
        },
      },
    );
  }

  function handleCancel(): void {
    cancelMutation.mutate(
      { reason: cancelReason },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setCancelReason("");
        },
      },
    );
  }

  function handleDelete(): void {
    deleteMutation.mutate(
      { reason: deleteReason, confirmSlug: deleteConfirmSlug },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          setDeleteReason("");
          setDeleteConfirmSlug("");
        },
      },
    );
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suspend */}
        <div className="flex items-center justify-between rounded-md border border-red-200 p-4">
          <div>
            <p className="font-medium">Suspend Tenant</p>
            <p className="text-muted-foreground text-sm">
              Disable access across all products. Data is preserved.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canUpdate || tenantStatus === "suspended"}
            onClick={() => setSuspendOpen(true)}
          >
            Suspend
          </Button>
        </div>

        {/* Cancel Subscription */}
        <div className="flex items-center justify-between rounded-md border border-red-200 p-4">
          <div>
            <p className="font-medium">Cancel Subscription</p>
            <p className="text-muted-foreground text-sm">
              Cancel at end of billing period. Access continues until then.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canUpdate}
            onClick={() => setCancelOpen(true)}
          >
            Cancel
          </Button>
        </div>

        {/* Delete Tenant */}
        <div className="flex items-center justify-between rounded-md border border-red-200 p-4">
          <div>
            <p className="font-medium">Delete Tenant</p>
            <p className="text-muted-foreground text-sm">
              Starts 90-day countdown to permanent deletion. Super admin only.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canDelete}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>

        {/* Suspend Dialog */}
        <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason (required)</Label>
                <Input
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Why is this tenant being suspended?"
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleSuspend}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
              >
                {suspendMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Suspension
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Subscription Dialog */}
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason (required)</Label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why is this subscription being cancelled?"
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Cancellation
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Tenant Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tenant (90-day countdown)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason (required)</Label>
                <Input
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why is this tenant being deleted?"
                />
              </div>
              <div>
                <Label>
                  Type <code className="text-destructive">{tenantSlug}</code> to
                  confirm
                </Label>
                <Input
                  value={deleteConfirmSlug}
                  onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                  placeholder={tenantSlug}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={
                  !deleteReason.trim() ||
                  deleteConfirmSlug !== tenantSlug ||
                  deleteMutation.isPending
                }
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Schedule Permanent Deletion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
