import { Routes, Route } from "react-router";
import { AuthLayout } from "@frontend/layouts/auth-layout.js";
import { DashboardLayout } from "@frontend/layouts/dashboard-layout.js";
import { PublicLayout } from "@frontend/layouts/public-layout.js";
import { SignupLayout } from "@frontend/layouts/signup-layout.js";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AdminRoute } from "@frontend/components/admin-route.js";
import { LoginPage } from "@frontend/pages/auth/login.js";
import { SignUpPage } from "@frontend/pages/auth/sign-up.js";
import { TwoFactorSetupPage } from "@frontend/pages/auth/two-factor-setup.js";
import { TwoFactorVerifyPage } from "@frontend/pages/auth/two-factor-verify.js";
import { DashboardPage } from "@frontend/pages/admin/dashboard.js";
import { TenantListPage } from "@frontend/pages/admin/tenants/tenant-list.js";
import { TenantDetailPage } from "@frontend/pages/admin/tenants/tenant-detail.js";
import { WebhookLogPage } from "@frontend/pages/admin/webhook-log.js";
import { LandingPage } from "@frontend/pages/public/landing.js";
import { PricingPage } from "@frontend/pages/public/pricing.js";
import { StepAccountPage } from "@frontend/pages/signup/step-account.js";
import { StepTwoFactorPage } from "@frontend/pages/signup/step-two-factor.js";
import { StepCompanyPage } from "@frontend/pages/signup/step-company.js";
import { StepReviewPage } from "@frontend/pages/signup/step-review.js";
import { CheckoutSuccessPage } from "@frontend/pages/signup/checkout-success.js";
import { CheckoutCancelledPage } from "@frontend/pages/signup/checkout-cancelled.js";

export function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Public marketing pages */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="pricing" element={<PricingPage />} />
      </Route>

      {/* Auth pages (admin login) */}
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

      {/* Self-service sign-up flow */}
      <Route element={<SignupLayout />}>
        <Route path="signup" element={<StepAccountPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="signup/2fa-setup" element={<StepTwoFactorPage />} />
          <Route path="signup/company" element={<StepCompanyPage />} />
          <Route path="signup/review" element={<StepReviewPage />} />
          <Route path="signup/success" element={<CheckoutSuccessPage />} />
          <Route path="signup/cancelled" element={<CheckoutCancelledPage />} />
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
            <Route
              path="admin/webhook-log"
              element={<WebhookLogPage />}
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
