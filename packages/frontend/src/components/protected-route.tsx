import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { authClient } from "@frontend/lib/auth-client.js";
import { useSecurityStatus } from "@frontend/hooks/use-2fa-status.js";

/**
 * Route guard that requires:
 * 1. A valid authenticated session
 * 2. Password change completed (bootstrap admin)
 * 3. Two-factor authentication enabled
 *
 * Exempt routes prevent redirect loops.
 */
export function ProtectedRoute(): React.JSX.Element {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const location = useLocation();
  const { twoFactorEnabled, mustChangePassword, isPending: securityPending } =
    useSecurityStatus(Boolean(session));

  if (sessionPending) {
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

  if (securityPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Force password change (bootstrap admin) — exempt the setup page itself
  const isOnSetupPage = location.pathname === "/auth/complete-setup";
  if (mustChangePassword === true && !isOnSetupPage) {
    return <Navigate to="/auth/complete-setup" replace />;
  }

  // 2FA enforcement — exempt setup pages
  const isOn2faPage =
    location.pathname === "/auth/2fa-setup" ||
    location.pathname === "/signup/2fa-setup";

  if (twoFactorEnabled === false && !isOn2faPage && !isOnSetupPage) {
    const setupPath = location.pathname.startsWith("/signup")
      ? "/signup/2fa-setup"
      : "/auth/2fa-setup";
    return <Navigate to={setupPath} replace />;
  }

  return <Outlet />;
}
