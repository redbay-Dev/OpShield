import { Routes, Route, Navigate } from "react-router";
import { AuthLayout } from "@frontend/layouts/auth-layout.js";
import { DashboardLayout } from "@frontend/layouts/dashboard-layout.js";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AdminRoute } from "@frontend/components/admin-route.js";
import { LoginPage } from "@frontend/pages/auth/login.js";
import { SignUpPage } from "@frontend/pages/auth/sign-up.js";
import { TwoFactorSetupPage } from "@frontend/pages/auth/two-factor-setup.js";
import { TwoFactorVerifyPage } from "@frontend/pages/auth/two-factor-verify.js";
import { DashboardPage } from "@frontend/pages/admin/dashboard.js";
import { TenantListPage } from "@frontend/pages/admin/tenants/tenant-list.js";
import { TenantDetailPage } from "@frontend/pages/admin/tenants/tenant-detail.js";

export function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Public redirect */}
      <Route index element={<Navigate to="/auth/login" replace />} />

      {/* Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/sign-up" element={<SignUpPage />} />
        <Route path="auth/2fa-verify" element={<TwoFactorVerifyPage />} />
      </Route>

      {/* 2FA setup requires auth but not admin */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="auth/2fa-setup" element={<TwoFactorSetupPage />} />
        </Route>
      </Route>

      {/* Admin dashboard */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="admin" element={<DashboardPage />} />
            <Route path="admin/tenants" element={<TenantListPage />} />
            <Route
              path="admin/tenants/:tenantId"
              element={<TenantDetailPage />}
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
