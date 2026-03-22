import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Shield, ShieldAlert, Eye, Trash2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { apiGet, apiPost, apiPatch, apiDelete } from "@frontend/api/client.js";

interface PlatformAdmin {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminListResponse {
  success: boolean;
  data: PlatformAdmin[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  support: "Support",
  viewer: "Viewer",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  super_admin: <ShieldAlert className="h-4 w-4" />,
  support: <Shield className="h-4 w-4" />,
  viewer: <Eye className="h-4 w-4" />,
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  support: "secondary",
  viewer: "outline",
};

export function AdminManagementPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteRole, setPromoteRole] = useState("support");
  const [error, setError] = useState("");

  const { data: admins, isPending } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async (): Promise<PlatformAdmin[]> => {
      const result = await apiGet<AdminListResponse>("/admin/platform-admins");
      return result.data;
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (input: { email: string; role: string }): Promise<void> => {
      await apiPost("/admin/platform-admins", input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      setPromoteEmail("");
      setError("");
      toast.success("Admin added");
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (input: { adminId: string; role: string }): Promise<void> => {
      await apiPatch(`/admin/platform-admins/${input.adminId}`, { role: input.role });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (adminId: string): Promise<void> => {
      await apiDelete(`/admin/platform-admins/${adminId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Admin removed");
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Admins</h1>
        <p className="text-muted-foreground">
          Manage who has access to the platform administration dashboard.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* Add admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Platform Admin</CardTitle>
          <CardDescription>
            The user must already have an account. Enter their email to grant admin access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="user@company.com"
              type="email"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={promoteRole} onValueChange={setPromoteRole}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={!promoteEmail || promoteMutation.isPending}
              onClick={() => void promoteMutation.mutate({ email: promoteEmail, role: promoteRole })}
            >
              {promoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current admins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Admins ({admins?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {admins?.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    {ROLE_ICONS[admin.role]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={admin.role}
                    onValueChange={(newRole) =>
                      void updateRoleMutation.mutate({ adminId: admin.id, role: newRole })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <Badge variant={ROLE_VARIANTS[admin.role] ?? "outline"}>
                        {ROLE_LABELS[admin.role] ?? admin.role}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeMutation.mutate(admin.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
