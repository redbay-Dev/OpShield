import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { authClient } from "@frontend/lib/auth-client.js";

export function ProtectedRoute(): React.JSX.Element {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/auth/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
}
