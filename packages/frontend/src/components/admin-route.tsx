import { Navigate, Outlet } from "react-router";
import { Loader2 } from "lucide-react";
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
    // Authenticated but not admin — send to app launcher
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
