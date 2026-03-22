import { Routes, Route } from "react-router";
import { AuthLayout } from "@frontend/layouts/auth-layout.js";
import { DashboardLayout } from "@frontend/layouts/dashboard-layout.js";
import { AccountLayout } from "@frontend/layouts/account-layout.js";
import { PublicLayout } from "@frontend/layouts/public-layout.js";
import { SignupLayout } from "@frontend/layouts/signup-layout.js";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AdminRoute } from "@frontend/components/admin-route.js";
import { LoginPage } from "@frontend/pages/auth/login.js";
import { SignUpPage } from "@frontend/pages/auth/sign-up.js";
import { TwoFactorSetupPage } from "@frontend/pages/auth/two-factor-setup.js";
import { TwoFactorVerifyPage } from "@frontend/pages/auth/two-factor-verify.js";
import { CompleteSetupPage } from "@frontend/pages/auth/complete-setup.js";
import { DashboardPage } from "@frontend/pages/admin/dashboard.js";
import { TenantListPage } from "@frontend/pages/admin/tenants/tenant-list.js";
import { TenantDetailPage } from "@frontend/pages/admin/tenants/tenant-detail.js";
import { WebhookLogPage } from "@frontend/pages/admin/webhook-log.js";
import { AuditLogPage } from "@frontend/pages/admin/audit-log.js";
import { SystemHealthPage } from "@frontend/pages/admin/system-health.js";
import { RevenuePage } from "@frontend/pages/admin/revenue.js";
import { SupportTicketsPage } from "@frontend/pages/admin/support-tickets.js";
import { SupportTicketDetailPage } from "@frontend/pages/admin/support-ticket-detail.js";
import { AdminManagementPage } from "@frontend/pages/admin/admin-management.js";
import { PlansPage } from "@frontend/pages/admin/plans.js";
import { LandingPage } from "@frontend/pages/public/landing.js";
import { PricingPage } from "@frontend/pages/public/pricing.js";
import { StepAccountPage } from "@frontend/pages/signup/step-account.js";
import { StepTwoFactorPage } from "@frontend/pages/signup/step-two-factor.js";
import { StepCompanyPage } from "@frontend/pages/signup/step-company.js";
import { StepReviewPage } from "@frontend/pages/signup/step-review.js";
import { CheckoutSuccessPage } from "@frontend/pages/signup/checkout-success.js";
import { CheckoutCancelledPage } from "@frontend/pages/signup/checkout-cancelled.js";
import { AccountOverviewPage } from "@frontend/pages/account/overview.js";
import { ProfilePage } from "@frontend/pages/account/profile.js";
import { BillingPage } from "@frontend/pages/account/billing.js";
import { NotificationsPage } from "@frontend/pages/account/notifications.js";

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

      {/* Account setup and 2FA require auth but not admin */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="auth/complete-setup" element={<CompleteSetupPage />} />
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

      {/* User self-service account */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AccountLayout />}>
          <Route path="account" element={<AccountOverviewPage />} />
          <Route path="account/profile" element={<ProfilePage />} />
          <Route path="account/billing" element={<BillingPage />} />
          <Route path="account/notifications" element={<NotificationsPage />} />
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
            <Route
              path="admin/audit-log"
              element={<AuditLogPage />}
            />
            <Route
              path="admin/system-health"
              element={<SystemHealthPage />}
            />
            <Route path="admin/revenue" element={<RevenuePage />} />
            <Route path="admin/support" element={<SupportTicketsPage />} />
            <Route
              path="admin/support/:ticketNumber"
              element={<SupportTicketDetailPage />}
            />
            <Route path="admin/plans" element={<PlansPage />} />
            <Route
              path="admin/admins"
              element={<AdminManagementPage />}
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
