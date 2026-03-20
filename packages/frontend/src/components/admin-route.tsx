import { Navigate, Outlet } from "react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { authClient } from "@frontend/lib/auth-client.js";
import { useAdminStatus } from "@frontend/hooks/use-admin-status.js";

export function AdminRoute(): React.JSX.Element {
  const { data: session } = authClient.useSession();
  const { data: adminStatus, isPending } = useAdminStatus(Boolean(session));

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!adminStatus?.isPlatformAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ShieldAlert className="text-destructive h-12 w-12" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          You do not have platform admin access.
        </p>
        <Navigate to="/auth/login" replace />
      </div>
    );
  }

  return <Outlet />;
}
