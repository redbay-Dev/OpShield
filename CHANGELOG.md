# Changelog

All notable changes to OpShield are documented here.

## [Unreleased] — Phase 10: Public Website & Self-Service Sign-Up

### Added
- **Landing page** (`/`): Public marketing page with hero, product cards (SafeSpec + Nexum), platform features (SSO, billing, provisioning), and call-to-action sections
- **Pricing page** (`/pricing`): Dynamic pricing display fetched from `GET /api/v1/plans` endpoint, monthly/annual toggle, plan tier cards with features, flat add-on module table, bundle discount explanation
- **Self-service sign-up wizard** (`/signup`): 4-step flow — account creation (Better Auth), 2FA setup (TOTP), company + module selection, order review with Stripe Checkout redirect
- **Public plans API**: `GET /api/v1/plans` — unauthenticated endpoint returning all active plans for pricing page
- **Slug availability check**: `GET /api/v1/signup/check-slug?slug=xxx` — authenticated endpoint for live slug validation during sign-up
- **Self-service checkout**: `POST /api/v1/signup/checkout` — authenticated endpoint that creates tenant (onboarding), adds modules, creates Stripe customer, initiates Stripe Checkout Session, returns checkout URL
- **Checkout webhook enhancement**: `checkout.session.completed` handler now upserts local subscription + subscription item records and triggers `provisionTenant()` for new sign-ups (onboarding → active)
- **`requireAuth` middleware**: Auth-only guard (no admin check) for endpoints accessible to any logged-in user
- **`determineCouponId` utility**: Extracted from subscriptions route to `services/billing-utils.ts` — shared by admin subscription creation and self-service checkout
- **Public layout**: Marketing layout with sticky header, nav links, CTA buttons, footer — adapts for mobile via Sheet nav
- **Signup layout**: Step-progress indicator (Account → Security → Company → Review) with SignupProvider context
- **Signup context**: React context sharing state across sign-up steps (account, 2FA, company details, module selections, billing interval)
- **Checkout result pages**: `/signup/success` (confirmation with provisioning status) and `/signup/cancelled` (retry option)
- **Frontend hooks**: `usePlans`, `useCheckSlug`, `useCheckout` React Query hooks for signup flow
- **shadcn components**: Added checkbox and radio-group for module/tier selection
- **Signup schemas**: `signupCheckoutSchema`, `signupModuleSelectionSchema`, `publicPlanResponseSchema`, `checkSlugQuerySchema` in shared package

### Module selection features
- Tiered module selection with radio buttons (SafeSpec WHS/HVA, Nexum Core)
- Flat add-on selection with checkboxes (Nexum optional modules, Fleet Maintenance)
- Dependency enforcement in UI: Fleet Maintenance disabled without HVA, Nexum Compliance disabled without SafeSpec, Nexum optional modules hidden without Core
- Live pricing calculation with bundle discount display (10% for 2 products, 15% for 3+ modules)
- Monthly/annual billing toggle with "save 2 months" badge

### Decisions
- DEC-036: Tenant created at checkout initiation (onboarding status), activated by Stripe webhook after payment
- DEC-037: Stripe Checkout Session (not direct subscription) for self-service — needed to collect payment method from new customers

### Tests
- Signup route auth guard tests (GET /plans public, GET /check-slug auth, POST /checkout auth)
- Signup schema validation tests (valid input, empty modules, invalid slug, invalid interval, invalid email)
- All 117 tests passing across 19 test files (4 packages)

### Still Missing
- **Support Hub** — No schema, routes, services, or UI (spec: `docs/06-SUPPORT-SYSTEM.md`)
- **Email/Notifications** — No SMTP service, templates, or queue (spec: `docs/08-NOTIFICATIONS-EMAIL.md`)
- **Tenant Self-Service Portal** — No account settings, billing portal, or invite flow for end users post-signup
- **SSO Provider Config** — `tenant_sso_providers` table exists but no routes or UI to configure per-tenant Azure AD
- **Advanced Platform Admin** — Missing: impersonation, audit log analytics, system health dashboard
- **Orphan tenant cleanup** — Onboarding tenants that never complete checkout should be cleaned up (deferred)

### Next Steps (Priority Order)
1. **Email/Notifications** (docs/08) — SMTP service, template engine, welcome email, billing alerts
2. **Support Hub** (docs/06) — DB schema (tickets, messages), API routes, email processing, admin UI
3. **Tenant Self-Service Portal** — Account settings, billing management for end users
4. **SSO Provider Config UI** — Routes + admin UI for per-tenant Azure AD configuration
5. **SafeSpec webhook handler** — Implement `tenant.created` handler in SafeSpec backend

## [Unreleased] — Phase 9: Polish & Admin Tooling

### Added
- **Auto-provisioning on module add**: When the first module for a product is added to a tenant, provisioning is automatically triggered — no manual "Provision" button click needed. Existing provisioned products are not re-triggered.
- **Webhook delivery log API**: `GET /api/v1/webhook-deliveries` (platform admin only) — paginated list of all outbound webhook deliveries with optional filters: `tenantId`, `productId`, `eventType`, `status` (success/failed)
- **Webhook delivery log admin page**: New "Webhook Log" page in the admin sidebar showing delivery history with status icons, HTTP status badges, error details, product/event filters, and pagination
- **Provisioning status auto-polling**: Provisioning tab now auto-refreshes every 5 seconds while any product has "dispatched" status, stopping automatically when all products reach success/failed
- **shadcn Select component**: Added for filter dropdowns in webhook log page
- **Webhook delivery schemas**: `webhookDeliveryQuerySchema`, `webhookDeliveryResponseSchema` in shared package

### Tests
- Webhook delivery route auth guard tests (4 tests)
- All 111 tests passing across 14 test files

### Still Missing
- **Support Hub** — No schema, routes, services, or UI (spec: `docs/06-SUPPORT-SYSTEM.md`)
- **Email/Notifications** — No SMTP service, templates, or queue (spec: `docs/08-NOTIFICATIONS-EMAIL.md`)
- **Public Website** — No landing, pricing, or sign-up pages
- **Tenant Self-Service** — No account settings, billing portal, or invite flow for end users
- **SSO Provider Config** — `tenant_sso_providers` table exists but no routes or UI to configure per-tenant Azure AD
- **Advanced Platform Admin** — Missing: impersonation, audit log analytics, system health dashboard
- **Email notification on provisioning failure** — Not yet implemented

### Next Steps (Priority Order)
1. **Support Hub** (docs/06) — DB schema (tickets, messages), API routes, email processing, admin UI
2. **Email/Notifications** (docs/08) — SMTP service, template engine, billing alerts
3. **Public Website** — Landing page, pricing page, sign-up flow with redirect
4. **SSO Provider Config UI** — Routes + admin UI for per-tenant Azure AD configuration
5. **SafeSpec webhook handler** — Implement `tenant.created` handler in SafeSpec backend

## [Unreleased] — Phase 8: Tenant Provisioning

### Added
- **Tenant provisioning service**: Dispatches `tenant.created` webhooks to product backends (SafeSpec, Nexum) with full tenant/module payload, tracks provisioning status per product, supports retry on failure
- **`tenant_provisioning` table**: Tracks per-product provisioning status (pending/dispatched/success/failed), attempt count, error details, and provisioned timestamp — unique constraint on (tenant_id, product_id)
- **Provisioning API routes**: `POST /tenants/:tenantId/provision` (trigger), `GET /tenants/:tenantId/provisioning-status` (check), `POST /tenants/:tenantId/retry-provisioning` (retry failed), `POST /tenants/:tenantId/provisioning-callback` (product reports result via service key)
- **Awaitable webhook send**: `sendProvisioningWebhook()` returns delivery result instead of fire-and-forget, enabling status tracking
- **Provisioning UI tab**: Admin tenant detail page now has a Provisioning tab showing per-product cards with status badge, attempt count, error display, and retry button
- **Shared schemas**: `provisioningStatusSchema`, `provisionTenantRequestSchema`, `provisioningCallbackSchema`, `retryProvisioningSchema`
- **Frontend hooks**: `useProvisioningStatus`, `useProvisionTenant`, `useRetryProvisioning`
- **DB migration**: `0004_tenant_provisioning.sql`
- **Tests**: Route auth guard tests and schema validation tests

### Decisions
- DEC-034: Products self-provision via webhook — OpShield never connects to product databases
- DEC-035: 200 from webhook = "received", not "provisioned" — products call back to confirm

### Still Missing (at time of release)
- SafeSpec does not yet handle the `tenant.created` webhook event (Nexum already does)
- ~~Automatic provisioning trigger on tenant creation~~ → **Resolved in Phase 9** (auto-triggers on module add)
- ~~Provisioning status polling/refresh in the UI~~ → **Resolved in Phase 9** (5s auto-polling while dispatched)
- Email notification to admin on provisioning failure

## [Unreleased] — Phase 7: Outbound Webhooks + Usage Reporting

### Added
- **Outbound webhook service**: HMAC-SHA256 signed webhooks dispatched to product backends (SafeSpec, Nexum) on module and tenant lifecycle events — `module.activated`, `module.suspended`, `module.cancelled`, `tenant.suspended`, `tenant.cancelled`, `tenant.reactivated`, `user_count.updated`
- **Webhook delivery logging**: `webhook_deliveries` table (append-only) tracks every outbound webhook with HTTP status, error details, and full payload for debugging
- **Usage reporting endpoint**: `POST /api/v1/usage` — service-key authenticated endpoint for products to report user counts per module, with cross-product validation and automatic `currentUsers` sync
- **Webhook dispatch in module routes**: Module add/update/delete operations now notify affected products in real-time
- **Webhook dispatch in Stripe webhook handlers**: Subscription deletion dispatches `tenant.cancelled`, payment failure dispatches `tenant.suspended`, checkout completion dispatches `tenant.reactivated` (when reactivating a suspended tenant)
- **Usage report schema**: `usageReportSchema` in shared package for validation
- **Webhook config**: Per-product webhook URL and secret configuration
- **DB migration**: `0003_webhook_deliveries` — creates `webhook_deliveries` table

### Decisions
- DEC-032: Fire-and-forget webhook dispatch (no retry queue in v1)
- DEC-033: HMAC-SHA256 webhook signatures with timestamp replay protection

### Still Missing
- Webhook receiver endpoints in SafeSpec (`/api/webhooks/opshield`) and Nexum — products need to implement signature verification and event handling
- Webhook retry/backoff queue (deferred to v2 — current approach logs failures to DB)
- Admin UI for viewing webhook delivery logs
- Tests for webhook service (`signPayload`, `dispatchWebhook`) and usage route
- Webhook secret generation tooling (currently must be set manually in `.env`)

### Next Steps
- Implement webhook receiver in SafeSpec and Nexum (see `docs/03-INTEGRATION-ARCHITECTURE.md` for contract)
- Add unit tests for `services/webhook.ts` (signature generation, skip-when-empty-secret logic)
- Add integration test for `POST /api/v1/usage` route
- Consider admin dashboard panel for webhook delivery log visibility
- Begin Phase 8 work per project roadmap

## [Unreleased] — Phase 6: Billing UI + Invoice API

### Added
- **Billing tab on tenant detail page**: Subscription status card with Stripe subscription ID, period dates, bundle discount, line items table, and cancel button with confirmation dialog
- **Create Subscription dialog**: Select billing interval (monthly/annual), creates Stripe subscription from tenant's active modules
- **Sync with Stripe button**: Re-fetches subscription status from Stripe to reconcile local state
- **Cancel Subscription flow**: Confirmation dialog, cancels at period end via Stripe API
- **Invoice history table**: Lists all invoices with status badges, amount, billing period, and links to Stripe-hosted invoice page and PDF download
- **Invoice API endpoint**: `GET /api/v1/tenants/:tenantId/invoices` — platform admin route returning all invoices for a tenant, ordered by date descending
- **Frontend billing hooks**: `useSubscription`, `useCreateSubscription`, `useSyncSubscription`, `useCancelSubscription`, `useInvoices` React Query hooks
- **Invoice response schema**: `invoiceResponseSchema` added to shared package
- **`apiDelete` body support**: DELETE requests can now include a JSON body (needed for cancel subscription's `atPeriodEnd` parameter)
- **Invoice route tests**: Auth guard verification for invoices endpoint

## [0.5.0] — Phase 5: Stripe Billing Integration (Backend Core)

### Added
- **Stripe webhook handler**: `POST /api/webhooks/stripe` with signature verification, idempotent event processing via `billing_events` table, and handlers for `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Subscription management API**: Platform admin CRUD at `/api/v1/tenants/:tenantId/subscription` — create (auto-builds line items from tenant modules + plans), get (with live Stripe enrichment), update (sync items when modules change), delete (cancel at period end)
- **Stripe client service**: Thin SDK wrapper (`packages/backend/src/services/stripe.ts`) with `createStripeCustomer`, `createStripeSubscription`, `updateStripeSubscription`, `cancelStripeSubscription`, `getStripeSubscription`, `constructWebhookEvent`
- **Stripe price sync script**: `pnpm stripe:sync` — reads plans from DB, creates/finds Stripe Products and Prices, updates plan records with Stripe price IDs, creates bundle discount coupons
- **DB schema additions**: `subscription_items` (line items per module), `tenant_usage` (append-only usage tracking), `billing_events` (immutable Stripe event log for dedup)
- **DB schema changes**: `subscriptions` — removed `stripe_price_id`/`product_id` (moved to items), changed `cancel_at_period_end` to boolean, added `stripe_coupon_id`; `plans` — added `stripe_per_user_price_id`
- **Billing schemas**: `createSubscriptionSchema`, `cancelSubscriptionSchema`, `subscriptionResponseSchema`, `subscriptionItemResponseSchema` in shared package
- **Billing constants**: `BILLING_INTERVALS`, `STRIPE_COUPONS` in shared package
- **Bundle discount logic**: Auto-applies 10% coupon for 2-product tenants, 15% for 3+ modules across both products
- **Tests**: Auth guard tests for all 4 subscription endpoints, webhook signature validation tests, Stripe service unit tests

### Changed
- Webhook route registered in its own Fastify scope with raw body parser (before `/api/v1` group)

## [0.4.0] — Phase 4: Module Management + Half-Built Fixes

### Added
- **Service API Key Authentication**: Product backends (SafeSpec, Nexum) can now authenticate to OpShield APIs via `x-product-api-key` header. Keys are SHA-256 hashed, generated by platform admins, and support revocation. Entitlements API now accepts both service keys and admin sessions.
- **Service Key Management API**: `POST/GET/DELETE /api/v1/service-keys` for platform admins to create, list, and revoke service API keys
- **Product-scoped entitlements**: When called via service key, entitlements response is automatically filtered to the calling product's modules
- **`requireServiceAuth` middleware**: Dual-mode authentication guard accepting service API keys or platform admin sessions
- **Module Management API**: Full CRUD for tenant modules (`POST/PATCH/DELETE /api/v1/tenants/:tenantId/modules/:moduleId`). Validates module belongs to product, enforces Nexum Compliance→SafeSpec dependency, prevents removing last SafeSpec module when Nexum Compliance is active. All operations audit-logged.
- **Module Management UI**: Add Module dialog (product/module picker, max users, status), inline status editing (click badge to change), remove module button with dependency protection
- **Dashboard improvements**: Recent tenants table with status badges and quick navigation links
- **Enriched entitlements response**: Modules now include matched plan info (tier, basePrice, perUserPrice, includedUsers) from the plans table
- **Module management schemas**: `addModuleSchema`, `updateModuleSchema`, `moduleIdParamSchema` in shared package
- **`apiDelete` client function**: Frontend HTTP DELETE support
- **Plan schema in entitlements**: `modulePlanSchema` added to shared and platform-types packages
- **Comprehensive schema tests**: 31 validation tests covering all Zod schemas (tenant CRUD, module management, entitlements, query params)

### Fixed
- **Entitlements response**: Now includes plan info (tier, pricing) — previously returned flat modules without plan context
- **Pagination response format**: Backend tenant list now returns `{ items, total, page, limit, totalPages }` inside `data` — previously pagination was a sibling of data, causing frontend to lose pagination info
- **Platform-types entitlement schema**: Added `plan` field (nullable) to match enriched backend response
- **API client response handling**: `handleResponse` now handles responses without `data` field (for DELETE operations)

### Known Issues
- `BETTER_AUTH_SECRET` in `.env.development` is placeholder — needs a proper 32+ char secret
- Stripe `current_period_start`/`current_period_end` were removed in Stripe API v2025-08-27 — period info is derived from `start_date` and synced via invoice webhook events
- `drizzle-kit generate` requires TTY for column rename prompts — migration `0002_stripe_billing_integration.sql` was written manually

### Next Steps (Priority Order)
1. **Configure Stripe test keys** — Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.development`
2. **Run price sync** — `pnpm stripe:sync` to create Stripe products/prices from plan data
3. **Usage reporting** — Product backends report user counts via webhook, populate `tenant_usage`
4. **Public checkout flow** — Stripe Checkout integration for self-service sign-up
5. **Support ticketing system** — Email-based support hub (spec in docs/06)

## [0.3.0] — Phase 3: Auth UI + Platform Admin Dashboard

### Added
- **Auth UI**: Login page, sign-up page, 2FA setup (TOTP QR code + backup codes), 2FA verification with device trust and backup code fallback
- **Platform Admin Dashboard**: Sidebar layout with responsive mobile sheet nav, dashboard home with tenant stat cards
- **Tenant Management UI**: Tenant list with search/filter/pagination, tenant detail with inline editing and module entitlements tab, create tenant dialog with auto-slug generation
- **Auth Infrastructure**: Better Auth React client with twoFactor plugin, ProtectedRoute and AdminRoute guards, session-based navigation
- **API Layer**: Typed fetch client (`api/client.ts`), React Query hooks for tenants and entitlements
- **Backend**: `GET /api/v1/me/admin-status` endpoint for frontend admin checks
- **shadcn/ui**: Initialized base-nova style with 13 components (button, input, label, card, dialog, table, tabs, badge, separator, avatar, dropdown-menu, sheet, sonner)
- **Vite Config**: `@shared` path alias, `.well-known` proxy for JWKS endpoint
- Updated frontend tests for new auth-based routing

## [0.2.0] — Phase 2: Database Foundation + Auth + Tenant CRUD + Entitlements API

### Added
- Better Auth integration with email/password, 2FA (TOTP), and JWT/JWKS plugins (DEC-021)
- Auth database schema: user, session, account, verification, two_factor, jwks tables
- Tenant-users join table (`tenant_users`) for multi-tenant user membership (DEC-020)
- Session middleware (`getSession`) for Fastify request authentication (DEC-022)
- Platform admin guard middleware (`requirePlatformAdmin`)
- Tenant CRUD routes: POST/GET/GET/:id/PATCH under `/api/v1/tenants` (platform admin only)
- Entitlements API: GET `/api/v1/tenants/:tenantId/entitlements`
- JWKS endpoint at `/.well-known/jwks.json` (proxies to `/api/auth/.well-known/jwks.json`)
- `@fastify/helmet` for security headers (DEC-023)
- Zod type provider (validatorCompiler/serializerCompiler) on Fastify app
- Shared schemas: updateTenantSchema, tenantResponseSchema, tenantListQuerySchema, tenantIdParamSchema
- Database seed script with plans (9 plans across 3 tiers), test tenant "Demo Haulage Pty Ltd", test user, platform admin
- Unit tests for tenant and entitlements routes (auth guard verification)
- Database migrations generated and applied (15 tables total)

## [0.1.0] — Phase 1: Scaffold

### Added
- Monorepo scaffold with pnpm 10 workspaces + Turborepo 2.8 (DEC-019)
- **Backend** (`@opshield/backend`): Fastify 5 server with health endpoint, Drizzle ORM 0.45 + Postgres client, config module, migration runner
- **Frontend** (`@opshield/frontend`): React 19 + Vite 8 + Tailwind CSS 4, React Router 7, TanStack Query, shadcn/ui dependencies, landing page placeholder
- **Shared** (`@opshield/shared`): Product/module constants, Zod 4 schemas (tenant creation, entitlements), TypeScript types
- **Platform Types** (`@redbay/platform-types`): Cross-product contract types — entitlements response schema, webhook payload schema
- **Database schema** (Drizzle, not yet migrated): tenants, tenant_modules, tenant_sso_providers, platform_admins, audit_log, subscriptions, plans, invoices
- ESLint 9 + Prettier config matching Nexum/SafeSpec conventions
- Dev environment config (`.env.development`) with shared infrastructure credentials
- Docker reference file documenting shared services
- Initial test suite: 7 tests across all 4 packages (health, constants, entitlements, App render)

### Known Issues (at time of release)
- Database migrations not yet generated (resolved in Phase 2)
- Better Auth not yet configured (resolved in Phase 2)
- No Stripe integration yet (schema only)
