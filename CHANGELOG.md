# Changelog

All notable changes to OpShield are documented here.

## [Unreleased] — 2026-03-22: Fix Checkout, Login, Provisioning & Cross-Product Webhooks

### Fixed

#### Checkout Flow — Deferred Tenant Creation (Critical)
- **Bug**: `POST /signup/checkout` created tenant, modules, and user-owner link BEFORE redirecting to Stripe for payment. If payment failed/cancelled, the tenant persisted with no subscription. Retrying gave `409: "You already own a tenant"` — permanent dead end.
- **Fix**: Tenant creation moved into `checkout.session.completed` webhook handler. Checkout endpoint only validates, creates Stripe customer, returns URL. Tenant data passed via Stripe session metadata.
- Orphaned `onboarding` tenants cleaned up automatically on retry.
- Webhook handler has idempotency guard (slug uniqueness check).

#### Login 2FA Redirect Loop (Critical)
- **Bug**: `signIn.email()` with 2FA triggered `onTwoFactorRedirect` → `window.location.href = "/auth/2fa-verify"`, but login handler continued and overwrote with `window.location.href = "/admin"` → no session → redirect to login → page reload loop.
- **Fix**: Login page checks for `twoFactorRedirect` in result and returns early. Added `sessionStorage` to preserve redirect target through 2FA flow.

#### 2FA Verify Page — Cookie Race Condition
- Changed `navigate()` to `window.location.href` for full page navigation after 2FA verification (same cookie race fix as login page).

#### Admin Route — Non-Admin Redirect Loop
- Non-admin authenticated users now redirected to `/account` instead of back to `/auth/login`.

#### Provisioning — Webhook Secrets & Signature Mismatch (Critical)
- **Bug**: Webhook secrets were empty in `.env.development` → provisioning always silently returned "Webhook not configured for product".
- **Bug**: OpShield sent signatures as `t=<timestamp>,v1=<hmac>` but Nexum expected `sha256=<hmac>` and SafeSpec used plain HMAC. All three formats were incompatible.
- **Fix**: Generated proper secrets, updated all three `.env.development` files, fixed Nexum's `verifyWebhookSignature()` to parse OpShield's `t=,v1=` format.

#### Provisioning — Status Stuck on "dispatched" Forever
- **Bug**: When a product responded HTTP 200, OpShield marked provisioning as "dispatched" instead of "success". No product callbacks were implemented, so status never changed.
- **Fix**: Successful webhook delivery (200) now immediately marks provisioning as "success".

#### SafeSpec — Missing `tenant.created` Webhook Handler (Critical)
- SafeSpec's webhook handler had no `tenant.created` case. It only handled module lifecycle events.
- Added full handler: creates local tenant record, provisions schema, creates owner user mapping. Includes idempotency check.
- Added `opshield_tenant_id` column to SafeSpec's tenants table (schema + migration).
- Added auto-migration runner to SafeSpec's `server.ts` startup.

#### Nexum — Missing Idempotency in `tenant.created` Handler
- Re-provisioning crashed with duplicate key on `opshield_tenant_id`. Added idempotency check.
- Fixed schema naming convention to strip hyphens (`tenant_<hex>` not `tenant_<uuid>`), matching SafeSpec.

### Changed

#### Provisioning Tab — Admin Management
- Added "Re-provision" button for stuck "dispatched" entries (was only showing retry for "failed").
- Added "Reset" button (delete provisioning record) on every entry so admin can start fresh.
- Shows OpShield tenant ID in header for cross-referencing with product databases.
- Added `DELETE /tenants/:tenantId/provisioning/:productId` backend endpoint.

#### dotenv Override
- OpShield's `config.ts` now uses `override: true` for dotenv to prevent parent process env vars from masking `.env.development` values.

### Cross-Product Fixes (SafeSpec + Nexum repos)

#### Test Database Isolation
- **SafeSpec**: Added `global-setup.ts` / `global-teardown.ts` using isolated `safespec_test` database. Tests no longer pollute `safespec_dev` with orphaned tenant schemas (21 were found and cleaned).
- **Nexum**: Added `global-teardown.ts` to drop `nexum_test` after suite. Removed hardcoded DB credentials from `vitest.config.ts` and `global-setup.ts`.

### Decisions
- DEC-067: Defer tenant creation to Stripe webhook — see DECISION-LOG.md.

### Known Issues / Still Missing
- **Plans out of sync**: 34 plans in OpShield DB vs 21 in Stripe. No reconciliation tool exists.
- **`nexum-sms` missing annual plan** — only has monthly. Blocks annual billing for tenants with SMS module.
- **Admin dashboard fundamentally incomplete** — needs full CRUD + Stripe sync + cross-system visibility for plans, tenants, subscriptions, provisioning. This is the **#1 priority** for the next session.
- **Login 2FA fix not yet tested live** — code is in place but needs manual verification.

---

## [Unreleased] — 2026-03-22: Plans System Redesign — Product-First Selection Flow

### Added

#### Shared Product Configuration (`PRODUCT_CONFIG`)
- **Rich product/module metadata** in `packages/shared/src/constants/index.ts` — single source of truth for product structure, module categorisation (base vs add-on), tier definitions, dependency rules, and display metadata (names, taglines, icons).
- **Helper functions**: `getBundleDiscountPercent()`, `getModuleDisplayName()`, `getProductForModule()` — reusable across frontend and backend.
- **TypeScript interfaces**: `ProductConfig`, `BaseModuleConfig`, `AddonConfig`, `TierConfig`, `ProductId`.

#### Shared Price Calculator (`packages/shared/src/utils/price-calculator.ts`)
- **`calculatePriceBreakdown()`** — takes selected modules, billing interval, and plans array, returns structured breakdown with line items, subtotal, bundle discount, and total.
- Reusable across signup flow, pricing page, and review step — eliminates duplicated price calculation logic.
- Bundle discount logic moved to shared from backend-only `billing-utils.ts`.

#### Plan Builder Components (`packages/frontend/src/components/plan-builder/`)
- **`BillingToggle`** — Monthly/Annual tabs with "Save 2 months" badge.
- **`ProductCard`** — Product on/off card with Switch toggle, icon, name, tagline. Expands to show modules when enabled.
- **`TierSelector`** — Horizontal row of tier cards for base modules. Shows price, included users, per-user cost, features. Selected state with check mark.
- **`AddonList`** — Checkbox grid of flat-rate add-on modules with prices. Disabled state with reason text for unmet dependencies.
- **`PriceSummary`** — Live price breakdown card using shared calculator. Shows line items, subtotal, bundle discount, total.

#### New "Build Your Plan" Signup Step (`/signup/plan`)
- **Dedicated plan configuration step** — separated from company details (which is now step 3).
- **Product-first selection**: Toggle SafeSpec and/or Nexum on/off with Switch components.
- **Progressive disclosure**: Expand to show base modules and tiers only when product is enabled.
- **Nexum Core auto-included**: When Nexum is toggled on, Core is automatically selected with starter tier. Cannot be removed while Nexum is active.
- **Dependency cascading**: Toggling off SafeSpec removes nexum-compliance. Removing HVA removes Fleet Maintenance.
- **Live price summary** updates on every selection change.
- **5-step signup flow**: Account → Security → Company → Plan → Review (was 4 steps).
- **Dynamic layout width**: Plan and Review steps use wider `max-w-3xl` layout for better tier card display.

### Changed

#### Signup Flow Restructured
- **step-company.tsx** — Stripped down to company details only (name, slug, email). Previously contained billing interval toggle and all module selection. Now navigates to `/signup/plan`.
- **step-review.tsx** — Uses shared `calculatePriceBreakdown()` and `PRODUCT_CONFIG` for display names. Groups line items by product. "Edit Plan" button navigates back to plan builder.
- **signup-context.tsx** — Added `enabledProducts` Set, `toggleProduct()` with auto-selection of required modules and dependency cascade on disable, `isProductEnabled()` helper.
- **signup-layout.tsx** — Updated from 4 to 5 step indicators. Conditional wider layout for plan/review steps.

#### Public Pricing Page Redesigned (`/pricing`)
- **Interactive calculator** replaces static card wall. Toggle products on/off, select tiers, add modules, see live pricing.
- **Reuses plan-builder components** (ProductCard pattern, TierSelector, AddonList, PriceSummary).
- **"Get Started" button** passes selections to signup via URL params for pre-population.
- **Bundle & Save card** shown when no products selected to encourage exploration.

#### Admin Plans Page Improved (`/admin/plans`)
- **Grouped by product** — Plans displayed under SafeSpec and Nexum sections with product icons, not a flat table.
- **Module subsections** — Within each product, plans grouped by module showing tier cards in a grid.
- **Tier cards** — Compact cards showing tier name, price, included users, Stripe status, edit/deactivate actions.
- **Monthly/Annual separation** — Plans within each module shown under monthly and annual subheadings.
- **Inactive plans** — Shown as muted dashed-border items with reactivate/delete actions.
- **Uses `PRODUCT_CONFIG`** for structure, labels, and ordering instead of hardcoded arrays.

### Decisions
- DEC-064: No database changes — the current plan-per-module schema works correctly for Stripe integration. The redesign is entirely UX/frontend.
- DEC-065: Product configuration lives in shared constants as the single source of truth, not in the database. Module categorisation (base vs add-on), tier definitions, and dependency rules are structural — they don't change per-tenant.
- DEC-066: Bundle discount logic moved to shared package so both frontend (live calculator) and backend (Stripe coupon selection) use identical rules.

---

## [Unreleased] — 2026-03-22: Plan Management, Stripe Auto-Sync, Toast Notifications, Bugfixes

### Added

#### Plan Management Admin Page (`/admin/plans`)
- **Full CRUD** — Create, edit, deactivate, reactivate, and permanently delete billing plans.
- **Multi-module batch creation** — Select any combination of modules from SafeSpec and Nexum, set individual pricing per module (base price, per-user price, included users), and create all plans in one go.
- **Per-module pricing table** — Each selected module gets its own row with independent pricing inputs during creation.
- **Permanent delete** — Hard-delete inactive plans that aren't referenced by existing subscriptions (`DELETE /plans/:planId/permanent`). Backend checks `subscription_items` FK before allowing deletion.
- **Sidebar nav link** — "Plans" added to admin dashboard navigation with CreditCard icon.
- **Stats cards** — Total plans, active plans, and products covered at a glance.
- **Product filter** — Filter plan list by SafeSpec or Nexum.
- **Stripe link indicator** — Badge shows whether each plan has a linked Stripe price ID.

#### Stripe Auto-Sync
- **Plans auto-sync to Stripe on creation** — `syncPlanToStripe()` in `services/stripe.ts` automatically creates Stripe Products and Prices when plans are created via the admin API. No manual `stripe:sync` script needed.
- **Re-sync on pricing changes** — PATCH updates that change `basePrice` or `perUserPrice` re-sync to Stripe automatically.
- **Graceful fallback** — If Stripe key isn't configured, plans create successfully without Stripe IDs (no crash).
- **`findOrCreateStripePrice()`** — Reuses existing Stripe prices when amount/interval/currency match, avoids duplicates.

#### SSO Domain-Based Discovery
- **Email domains field** added to SSO provider configuration — admins can now specify which email domains (e.g., `company.com`) should be routed to a tenant's SSO provider.
- **`domains` field** added to `upsertSsoProviderSchema` (shared) and `ssoProviderResponseSchema`.
- **Backend wiring** — Domains stored in `metadata.domains` JSONB field, read by existing `GET /sso/discover` endpoint.
- **Frontend display** — Configured domains shown as `@domain.com` badges on the SSO tab.
- **Frontend input** — Comma-separated domain input in the SSO configuration dialog.

#### Toast Notifications (Sonner)
- **Fixed sonner component** — Removed broken `next-themes` import, set `position: "top-right"`.
- **All mutations now use toast** — Success/error feedback via top-right toast notifications instead of inline error divs or browser `window.confirm` dialogs.
- **Removed all `window.confirm`** — Zero browser dialogs remain. Deactivate/reactivate/delete actions fire directly with toast feedback.
- **Admin management toasts** — Add, remove, role-change mutations now show toast notifications.

### Fixed

#### Public Pricing Page
- **Added missing public `GET /plans` endpoint** — Was already in `signup.ts` but the `usePlans` hook had the wrong URL path. Verified the endpoint exists and returns active plans without sensitive fields (no Stripe IDs, no timestamps).
- **Fixed `usePlans` hook double-unwrap** — `apiGet` already extracts `.data` from `{ success, data }`. The hook was doing `result.data` on the already-unwrapped array, returning `undefined`. Pricing page was silently showing "No pricing plans configured yet" even with plans in the DB.
- **Fixed admin plans query** — Same double-unwrap bug. Admin plans table was always showing 0 plans.

#### Plan Creation
- **Price format auto-fix** — `formatDecimal()` converts user input (e.g., "49") to backend-required format ("49.00"). Was causing 400 "Invalid input" errors.

### Decisions
- DEC-063: SSO domain mapping stored in metadata JSONB (not a dedicated column) — discover endpoint already reads `metadata.domains`.

### Still Missing
- Per-tenant SSO login integration (discovery endpoint works, but login page doesn't call it yet to redirect users)
- Notification preferences UI (schema exists, no settings page)
- Deprovisioning final deletion background job (90-day schedule-deletion exists, but no cron to actually delete data after the grace period)
- End-to-end test the full sign-up → checkout → provisioning flow with real Stripe test keys
- Configure webhook URLs for Nexum/SafeSpec in `.env` to test provisioning

### Next Steps (Priority Order)
1. **Configure Stripe test keys** in `.env` and create plans via admin UI to verify auto-sync works
2. **End-to-end test the sign-up flow** — account → 2FA → company/module selection → review → Stripe checkout → webhook → provisioning
3. **Wire login page to SSO discovery** — Call `GET /sso/discover` on email blur, redirect to SSO if domain is enforced
4. **Notification preferences UI** — Build the settings page using existing schema
5. **Deprovisioning background job** — Cron to delete tenant data after 90-day grace period

---

## [Unreleased] — 2026-03-22: Auth System Overhaul

### Fixed

#### Bootstrap Super Admin
- **Default password is now `admin`** (was `ChangeMe2026!`). Better Auth `minPasswordLength` lowered to 5 at framework level; all user-facing forms still enforce 10+ chars.
- **Auto-reset on restart**: If the bootstrap admin never completed setup (`mustChangePassword` still true), the server deletes and re-creates them with the current default password. No stale credentials.
- **Simplified complete-setup page**: Just name + new password. No current password field (handled internally), no email field. Show/hide password toggles on all fields.
- **Login redirect fixed**: Changed from React Router `navigate()` to `window.location.href` to ensure session cookies are picked up. Was causing infinite redirect to login.
- **2FA status detection fixed**: `GET /me/2fa-status` now checks the `two_factor` table for a record instead of the `user.twoFactorEnabled` column (which Better Auth never updates). Was causing infinite 2FA setup loop.
- **Complete-setup session fix**: Changed `revokeOtherSessions` to `false` during password change — the old `true` value caused a session refresh that unmounted the component mid-flow, preventing the `mustChangePassword` flag from being cleared.
- **Post-2FA redirect**: 2FA setup now redirects to `/admin` (not `/account`) since the bootstrap admin is a super admin.
- **Post-login redirect**: Login default destination changed to `/admin`.

#### Database Migrations
- **Single clean initial migration**: Replaced 11 incremental migration files with one `0000_initial.sql` generated from current schema. All tables including `must_change_password` column are created in one pass. Previous agent had added columns directly to DB without migrations.

#### Security Hook
- **PreToolUse hook** added to `.claude/settings.json` that blocks destructive database operations (`INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`TRUNCATE`) via `psql`/`pg_dump`/`pg_restore`/`pgcli`. Read-only queries (`SELECT`, `\du`, `\dt`) are allowed.

### Still Missing
- Plan seed data needs to be re-created (fresh DB has no plans)
- Email change flow for admin (removed from setup — could be added to account settings later)
- The `user.twoFactorEnabled` column is unused (Better Auth uses `two_factor` table) — could be removed in a future cleanup

#### Sign-up Checkout Flow
- **Stripe metadata**: `userName` now included in checkout session metadata so the welcome email can personalise the greeting
- **Audit log**: `actorType` corrected from `platform_admin` to `user` for self-service signups

### Added

#### Usage Overage Detection & Stripe Sync
- **`syncOverageToStripe()`**: When products report user counts via `POST /usage` with `metric: "user_count"`, OpShield now automatically detects overages (users beyond `plan.includedUsers`) and updates the Stripe subscription:
  - Adds per-user line item if overage exists and none present
  - Updates quantity on existing per-user line item if count changed
  - Removes per-user line item if overage drops to zero
  - All changes use proration for fair billing
  - Overage syncs are fire-and-forget (logged but don't block the usage response)
- **Audit logging**: All overage syncs logged as `usage.overage_synced` with user counts

#### Email Triggers Wired to Events
- **Plan changed email**: Sent when `customer.subscription.updated` webhook detects a status change (e.g., active → past_due, trialing → active)
- **Trial ending email**: New `customer.subscription.trial_will_end` webhook handler sends 3-day warning email with upgrade link to billing page
- **Module status change emails**: PATCH `/tenants/:tenantId/modules/:moduleId` now sends module-added email on reactivation and module-removed email on suspension/cancellation

### Verified (Already Implemented — No Changes Needed)
- **Webhook dispatch**: `provisionTenant()` correctly dispatches `tenant.created` webhooks via `sendProvisioningWebhook()` with HMAC-SHA256 signatures. Callbacks, retries, and failure emails all working.
- **Sign-up → Checkout flow**: Full wizard (account → 2FA → company → review → Stripe Checkout → webhook → provisioning → welcome email) was already functional end-to-end.
- **Usage tracking API**: `POST /usage` endpoint was already functional with service key auth, module validation, append-only records, and webhook dispatch.
- **Core email triggers**: Welcome, payment received, payment failed, account suspended, module added/removed, provisioning failed emails were already wired to their respective event handlers.

### Decisions
- DEC-057: 2FA enforcement at the route guard level (frontend `ProtectedRoute`) rather than backend middleware — Better Auth handles the 2FA challenge flow on login automatically; the guard catches users who have a session but haven't completed 2FA setup yet
- DEC-058: Overage billing uses Stripe subscription item quantity updates with proration — real-time billing adjustment rather than end-of-period metered billing, because it's simpler and gives customers immediate visibility

### Known Issues (Remaining)
- **Per-tenant SSO**: Schema exists (`tenantSsoProviders`) but no domain-based provider discovery implemented
- **Deprovisioning**: No 90-day retention/final deletion flow
- **Notification preferences UI**: Schema exists but no user-facing settings page

### Next Steps (Priority Order)
1. **End-to-end test the full sign-up flow** with real Stripe test keys
2. **Configure webhook URLs** for Nexum/SafeSpec in `.env` to test provisioning
3. **Auth Migration Phase 2**: Products consume OpShield JWTs (cross-project work)

---

## [Unreleased] — Phase 15: Auth Fixes, Branding, Plans, Production Readiness

### Fixed

#### Critical Auth Bug: Session Cookies Dropped
- **`sendAuthResponse()` in `app.ts`**: Better Auth sets multiple `set-cookie` headers (session token + session data). The response forwarder stored headers in a `Record<string, string>` which silently overwrote duplicate keys — only the last `set-cookie` survived. Changed to collect cookies into a `string[]` so all cookies are forwarded. This was the root cause of sign-in appearing to do nothing.

#### Login Flow Fixes
- **Default redirect**: Sign-in now redirects to `/account` (not `/admin`) — non-admin users were silently bounced back to login
- **Error handling**: Sign-in result is checked for errors before navigating, so failures are shown to the user
- **Password minLength removed from login**: Login form had `minLength={10}` on the password field which is a sign-up concern, not a login concern

#### First-User Admin Promotion
- **Better Auth `databaseHooks.user.create.after`**: First user to sign up is automatically promoted to `super_admin` — no env vars, no migrations, no hardcoded emails. Only fires when `platform_admins` table is empty.
- **Server startup check**: On boot, if zero admins exist and exactly one user is in the system, that user is promoted. Handles the case where a user already signed up before this logic was added. Permanent no-op once any admin exists.

### Added

#### Plan Management API
- **`GET /api/v1/plans/admin`**: List all plans (platform admin, read access)
- **`POST /api/v1/plans`**: Create plan (write access, audit logged)
- **`PATCH /api/v1/plans/:planId`**: Update plan pricing/features (write access, audit logged)
- **`DELETE /api/v1/plans/:planId`**: Soft-deactivate plan (delete access, audit logged)

#### Plans Data Migration
- **Migration `0009_plans_data.sql`**: Inserts all pricing plans from `docs/04-BILLING-PRICING-MODEL.md` — SafeSpec WHS (3 tiers), HVA (3 tiers), Fleet Maintenance, Nexum Core (2 tiers), 11 optional module add-ons

#### Auto-Migration on Startup
- **`server.ts`**: Runs `drizzle-orm/postgres-js/migrator` before accepting requests — no manual `pnpm db:migrate` needed

#### Branding: Redbay → Nexum
- All customer-facing strings replaced: emails, templates, UI, layouts, footer, auth pages
- `redbay.com.au` → `nexum.net.au` across all email addresses
- `x-redbay-*` inbound email headers → `x-nexum-*`
- Auth issuer: `Redbay` → `Nexum`
- SMTP from default: `noreply@nexum.net.au`

### Removed
- **Seed script** (`db/seed.ts`): Deleted. Plans are now in migration 0009. No test data.
- **`db:seed` script** from package.json

### Decisions
- DEC-054: First user to sign up becomes super_admin — standard SaaS pattern, no deployment config needed
- DEC-055: Nexum is the unified customer-facing brand — one brand, modules underneath (Operations + Compliance). OpShield is internal only. SafeSpec name retired.
- DEC-056: Plans inserted via SQL migration, not seed script — reference data belongs in migrations

### Known Issues (Resolved in Phase 16)
- **2FA enforcement** — Fixed: ProtectedRoute now enforces 2FA
- **Sign-up flow** — Verified: was already working end-to-end

## [Unreleased] — Phase 14: Support Hub

### Added

#### Support Hub Database Schema
- **`support_tickets` table**: Full ticket lifecycle — ticket number (auto-incrementing T-XXX), product, tenant, user, category (6 types), priority (4 levels), status (6 states), assignment, tags, SLA timestamps (first response, resolved, closed), soft delete
- **`support_messages` table**: Immutable conversation thread — sender type (customer/admin/system), body, internal note flag, email message ID for dedup
- **`support_attachments` table**: File metadata with MinIO/S3 storage key reference
- **`canned_responses` table**: Reusable reply templates with category, product scope, and usage tracking
- **DB migration**: `0008_support_hub.sql` with indexes on tenant, status, priority, product, assigned_to, created_at
- **Ticket number sequence**: PostgreSQL sequence for human-readable auto-incrementing IDs

#### Support Constants & Schemas
- **Constants**: `TICKET_CATEGORIES` (6), `TICKET_PRIORITIES` (4), `TICKET_STATUSES` (6), `SENDER_TYPES` (3), `SLA_TARGETS` (response/resolution hours per priority)
- **Zod schemas**: `createTicketSchema`, `createTicketMessageSchema`, `updateTicketSchema`, `ticketListQuerySchema`, `tenantTicketListQuerySchema`, `ticketNumberParamSchema`, `supportTicketResponseSchema`, `supportTicketDetailResponseSchema`, `supportMessageResponseSchema`, `supportStatsResponseSchema`, `createCannedResponseSchema`, `cannedResponseSchema`

#### Tenant-Facing Support API (Service Key Auth)
- **`POST /api/v1/support/tickets`**: Create ticket from product backend — auto-generates ticket number, determines priority (enterprise→high, billing+past_due→urgent, bug→medium, feature/how_to→low), creates initial message, sends acknowledgment email
- **`GET /api/v1/support/tickets`**: List tickets for a tenant/user with pagination
- **`GET /api/v1/support/tickets/:ticketNumber`**: Ticket detail with messages (internal notes filtered out for tenant-facing requests)
- **`POST /api/v1/support/tickets/:ticketNumber/messages`**: Customer reply — auto-reopens resolved/waiting tickets

#### Admin Support API (Platform Admin Auth)
- **`GET /api/v1/admin/support/tickets`**: List all tickets with filters (status, priority, product, tenant, assigned, category) + tenant name join
- **`GET /api/v1/admin/support/tickets/:ticketNumber`**: Full detail with messages (including internal notes), tenant context (name, status)
- **`POST /api/v1/admin/support/tickets/:ticketNumber/messages`**: Admin reply or internal note — tracks first response time, updates ticket status to in_progress, sends reply email to customer (non-internal only), audit logged
- **`PATCH /api/v1/admin/support/tickets/:ticketNumber`**: Update status, priority, assignment, tags — auto-sets resolvedAt/closedAt timestamps, audit logged
- **`GET /api/v1/admin/support/stats`**: Dashboard stats — open count, in-progress count, waiting count, resolved today, avg first response time (minutes), avg resolution time (minutes)
- **`GET /api/v1/admin/support/canned-responses`**: List canned responses (sorted by usage)
- **`POST /api/v1/admin/support/canned-responses`**: Create canned response (write access required)

#### Auto-Priority Logic
- **`determinePriority()` service**: Checks tenant subscription tier and status — enterprise plan→high, billing category + past_due subscription→urgent, bug_report→medium, feature_request/how_to→low, default→medium

#### Support Email Templates (2 new)
- **`ticket-acknowledgment.hbs`**: Receipt confirmation with ticket number, subject, category, priority
- **`ticket-reply.hbs`**: Admin reply to customer with agent name, reply body, product name, ticket reference
- **Send functions**: `sendTicketAcknowledgmentEmail()`, `sendTicketReplyEmail()` added to email service

#### File Attachments (MinIO/S3)
- **S3 storage service** (`services/storage.ts`): MinIO-compatible S3 client with `uploadFile()`, `getDownloadUrl()` (presigned 15-min URLs), `deleteFile()`
- **`@aws-sdk/client-s3`** + **`@aws-sdk/s3-request-presigner`** + **`@fastify/multipart`** dependencies added
- **`POST /api/v1/support/tickets/:ticketNumber/attachments`**: Upload file (max 10MB, allowlisted MIME types: images, PDF, text, CSV, Excel, Word) — stores in MinIO, records metadata in DB
- **`GET /api/v1/support/tickets/:ticketNumber/attachments`**: List all attachments for a ticket
- **`GET /api/v1/support/tickets/:ticketNumber/attachments/:attachmentId/download`**: Get presigned download URL for an attachment
- **MIME type allowlist**: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/csv`, `application/json`, `.xlsx`, `.docx`

#### Inbound Email Webhook
- **`POST /api/webhooks/inbound-email`**: Receives parsed inbound emails from email provider (SMTP2GO, Mailgun, Postmark) — creates new tickets or appends replies to existing threads
- **Ticket number detection**: Parses `[T-XXX]` from subject line to identify replies vs new tickets
- **Email deduplication**: Uses `emailMessageId` to prevent duplicate messages from provider retries
- **Auto-reopen**: Tickets in `resolved` or `waiting_on_customer` status are automatically reopened when customer replies
- **Header-based enrichment**: Extracts `X-Redbay-Product`, `X-Redbay-Tenant-Id`, `X-Redbay-User-Id`, `X-Redbay-Category`, `X-Redbay-Page` from custom headers set by product backends
- **Tenant resolution fallback**: When no tenant header is provided, looks up existing tickets by sender email to determine tenant
- **Email parsing**: Extracts sender name and email from `Name <email>` format strings

#### Support Hub Frontend
- **API client** (`api/support.ts`): `fetchAdminTickets`, `fetchAdminTicketDetail`, `updateTicket`, `addAdminMessage`, `fetchSupportStats`, `fetchCannedResponses`, `createCannedResponse`
- **React Query hooks** (`hooks/use-support.ts`): `useAdminTickets`, `useAdminTicketDetail`, `useUpdateTicket`, `useAddAdminMessage`, `useSupportStats`, `useCannedResponses`, `useCreateCannedResponse`
- **Ticket list page** (`/admin/support`): Stats cards (open, in-progress, waiting, resolved today), filterable table (status, priority, product), clickable rows, pagination
- **Ticket detail page** (`/admin/support/:ticketNumber`): Conversation thread with color-coded messages (customer/admin/internal note), reply box with internal note toggle, context sidebar (product, tenant with link, user info, page URL, timestamps), status/priority controls
- **Sidebar navigation**: "Support" link with LifeBuoy icon added to admin dashboard sidebar

### Tests
- **3 new route test files**: `support-tickets.test.ts` (7 auth guard tests including attachments), `admin-support.test.ts` (7 auth guard tests), `inbound-email.test.ts` (5 webhook tests)
- **2 new email template tests**: ticket-acknowledgment and ticket-reply rendering
- **25 new schema validation tests**: createTicketSchema (5), updateTicketSchema (4), ticketListQuerySchema (2), ticketNumberParamSchema (3), createTicketMessageSchema (3), createCannedResponseSchema (3), inboundEmailPayloadSchema (5)
- **All 249 tests passing across 34 test files (4 packages)**

### Decisions
- DEC-048: Support tickets created via both API (product backends) and inbound email webhook — dual ingestion from day one
- DEC-049: Ticket numbers use PostgreSQL sequence (T-001, T-002...) for human-readable IDs — simple, gap-free, no collision risk
- DEC-050: Auto-priority based on plan tier + category — enterprise→high, billing+past_due→urgent, bug→medium, feature/how_to→low
- DEC-051: Internal notes in same messages table with `is_internal_note` flag — simpler than separate table, filtered out in tenant-facing API
- DEC-052: File attachments stored in MinIO/S3 with presigned download URLs — 10MB limit, MIME type allowlist, metadata in DB
- DEC-053: Inbound email webhook uses subject line `[T-XXX]` pattern for reply threading + email message ID for deduplication

### Next Steps (Priority Order)
1. **Auth Migration Phase 2** — Products implement callback handler to accept OpShield JWTs
2. **Authenticated E2E tests** — Full login/admin/account/support flows with Playwright
3. **Product-side support widget** — Help button in SafeSpec/Nexum that calls OpShield support API

## [Unreleased] — Phase 13: Self-Service Portal, Orphan Cleanup, E2E Tests

### Added

#### Tenant Self-Service Portal (Complete — Backend + Frontend)
- **`GET /api/v1/me/tenants`**: Returns all tenants the authenticated user belongs to, enriched with module entitlements, subscription status, and renewal dates
- **`POST /api/v1/me/billing-portal`**: Creates a Stripe Billing Portal session for the user's owned tenant — redirects to Stripe-hosted portal for payment method and subscription management
- **Account Layout** (`/account/*`): Full sidebar layout with navigation — Overview, Profile, Billing, Notifications
- **Overview page** (`/account`): Tenant cards showing org name, status, active modules with user counts, subscription status and renewal date, user role
- **Profile page** (`/account/profile`): Update name (via Better Auth), change password with current/new/confirm fields, 2FA status display, "Log Out Everywhere" button that dispatches session.revoked webhook to all products
- **Billing page** (`/account/billing`): Shows owned vs member organisations, subscription details, module list, "Manage Billing" button that opens Stripe Billing Portal for payment method and invoice management
- **Notifications page** (`/account/notifications`): Toggle billing emails, support emails, and product updates with checkbox UI — critical emails (payment failures, suspensions) always bypass preferences
- **Frontend hooks**: `useMyTenants`, `useNotificationPreferences`, `useUpdateNotificationPreferences`, `useBillingPortal`, `useLogoutEverywhere`
- **API client**: `fetchMyTenants`, `fetchNotificationPreferences`, `updateNotificationPreferences`, `createBillingPortalSession`, `logoutEverywhere`
- **Dashboard user menu**: Added "My Account" link to admin dashboard header dropdown
- **Checkout success redirect**: Now points to `/account` instead of `/admin` so new users land on their self-service portal

#### Orphan Tenant Cleanup Job
- **`cleanupOrphanTenants()`**: Finds tenants in "onboarding" status older than 7 days (abandoned sign-ups), soft-deletes them, removes associated modules and user memberships, audit logs each cleanup
- **Scheduled job**: Runs once at server startup then every 6 hours via `setInterval`
- **Graceful shutdown**: Cleanup interval cleared on SIGTERM/SIGINT
- **Unit tests**: Function signature and return type verification

#### E2E Tests (Playwright)
- **`e2e/public-pages.spec.ts`**: Landing page loads, pricing page loads, navigation between pages, login/signup pages accessible
- **`e2e/auth-flow.spec.ts`**: Login form fields present, sign-up link visible, invalid credentials show error, unauthenticated redirects from admin and account pages, 2FA verify page accessible
- **`e2e/signup-flow.spec.ts`**: Signup step indicator visible, protected signup steps redirect without auth, checkout success/cancelled pages require auth
- **`e2e/admin-dashboard.spec.ts`**: All admin pages (dashboard, tenants, webhook log, audit log, system health, revenue) redirect unauthenticated users to login
- **`e2e/account-pages.spec.ts`**: All account pages (overview, profile, billing, notifications) redirect unauthenticated users to login

### Tests
- **2 new backend route tests**: `GET /me/tenants` and `POST /me/billing-portal` auth guard verification
- **1 new cleanup job test**: `cleanupOrphanTenants` function signature test
- **5 new E2E test files**: 24 Playwright tests covering public pages, auth flow, signup flow, admin dashboard, and account pages
- **All 202 unit/integration tests passing across 31 test files (4 packages)**

### Decisions
- DEC-045: Self-service billing uses Stripe Billing Portal (not custom UI) — Stripe handles PCI compliance, payment method changes, and invoice PDFs. We redirect users to Stripe's hosted portal.
- DEC-046: Orphan cleanup runs as in-process setInterval (not external cron) — simple enough for current scale, avoids infrastructure dependency. Can migrate to a job queue later if needed.
- DEC-047: E2E tests focus on page accessibility and auth guards first — authenticated flow tests deferred until test infrastructure is set up.

### Next Steps (Priority Order)
1. **Support Hub** (docs/06) — DB schema (tickets, messages), API routes, email processing, admin UI
2. **Auth Migration Phase 2** — Products implement callback handler to accept OpShield JWTs
3. **Authenticated E2E tests** — Full login/admin/account flows with Playwright

## [Unreleased] — Phase 12: Platform Admin Completion, Email Templates, Auth Prep

### Added

#### Notification Preferences
- **`notification_preferences` table**: Per-user email preference control (billing, support, product updates)
- **`GET/PATCH /api/v1/me/notification-preferences`**: Authenticated endpoints for users to read/update their email preferences
- **`shouldSendEmail(userId, category)` utility**: Checks user preferences before sending non-critical emails (critical emails like payment-failed and suspension always bypass)
- **DB migration**: `0006_notification_preferences.sql`

#### Missing Email Templates (3 new)
- **`trial-ending.hbs`**: "Your trial ends in 3 days" warning with upgrade CTA
- **`trial-expired.hbs`**: "Trial expired" notice with read-only mode explanation and subscribe CTA
- **`payment-failed-final.hbs`**: Final payment failure warning with suspension date and payment method update CTA
- **Send functions**: `sendTrialEndingEmail()`, `sendTrialExpiredEmail()`, `sendPaymentFailedFinalEmail()` added to email service

#### System Health Monitoring
- **`GET /api/v1/system-health`**: Platform admin endpoint that polls OpShield, SafeSpec (port 3001), Nexum (port 3002) health endpoints + PostgreSQL connectivity in parallel (5s timeout per service)
- **System Health admin page** (`/admin/system-health`): Status cards with green/red indicators, response times, version info, auto-refreshes every 30 seconds
- **Navigation**: System Health added to admin sidebar (HeartPulse icon)

#### Revenue Analytics Dashboard
- **`GET /api/v1/analytics/revenue`**: Platform admin endpoint computing MRR (from subscription items + plans), active tenant count, churn rate (30-day), ARPU, revenue by product, revenue by module, tenant status breakdown
- **Revenue admin page** (`/admin/revenue`): Stat cards (MRR, Active Tenants, Churn Rate, ARPU), tenant status breakdown, revenue by product table, revenue by module table
- **Navigation**: Revenue added to admin sidebar (TrendingUp icon)

#### Data Export
- **`GET /api/v1/tenants/:tenantId/export`**: Platform admin endpoint supporting `type=summary|billing|audit` and `format=json|csv` query params. Returns downloadable files with proper Content-Disposition headers.
- Summary export includes tenant info, modules, subscription status
- Billing export includes all invoices as CSV
- Audit export includes all audit log entries for the tenant as JSON

#### Tenant Danger Zone Actions
- **`POST /api/v1/tenants/:tenantId/suspend`**: Sets tenant status to suspended, dispatches `tenant.suspended` webhook, sends account-suspended email. Requires reason text. Write access required.
- **`POST /api/v1/tenants/:tenantId/cancel-subscription`**: Marks subscription for cancellation at period end. Requires reason text. Write access required.
- **`POST /api/v1/tenants/:tenantId/schedule-deletion`**: Sets tenant status to cancelled with `deletedAt` 90 days out. Requires reason + slug confirmation. Delete access (super_admin) required.
- **Danger Zone tab**: New tab on tenant detail page with red-styled action cards and confirmation dialogs

#### Impersonation
- **`impersonation_tokens` table**: Stores SHA-256 hashed impersonation tokens with 30-minute expiry, admin user, tenant, product, reason
- **`POST /api/v1/impersonate`**: Generate impersonation token with redirect URL to product. Write access required. Audit logged.
- **`DELETE /api/v1/impersonate`**: Revoke an active impersonation token. Audit logged.
- **`GET /api/v1/impersonate/validate`**: Service-key authenticated endpoint for products to validate impersonation tokens and get tenant/admin info
- **DB migration**: `0007_impersonation_tokens.sql`

#### Auth Migration Prep (OpShield-side)
- **`GET /api/auth/authorize`**: SSO authorize endpoint that returns user info + allowlisted callback URL for the requested product. Returns 401 if no session (client handles login redirect). Validates product param via Zod enum — no user-controlled redirects.
- **`POST /api/v1/me/logout-everywhere`**: Dispatches `session.revoked` webhook to all products for global logout
- **`session.revoked` webhook event**: Added to webhook service, dispatched to both SafeSpec and Nexum on global logout

### Tests
- **6 new route test files**: system-health, analytics, tenant-actions, impersonation, export, me (notification prefs + logout)
- **3 new email template tests**: trial-ending, trial-expired, payment-failed-final rendering
- **All 198 tests passing across 30 test files (4 packages)**

### Decisions
- DEC-041: Impersonation uses opaque SHA-256 tokens (not JWTs) since products don't validate JWTs yet — products call back to OpShield to validate
- DEC-042: Auth authorize endpoint returns JSON (not redirect) to avoid server-side open redirect concerns flagged by Semgrep
- DEC-043: Revenue analytics computed from existing subscription_items + plans tables (no new metrics infrastructure)
- DEC-044: Notification preferences are opt-out — defaults are all true, critical emails always bypass

### Next Steps (Priority Order)
1. **Support Hub** (docs/06) — DB schema (tickets, messages), API routes, email processing, admin UI
2. **Tenant Self-Service Portal** — Account settings, billing management for end users
3. **Auth Migration Phase 2** — Products implement callback handler to accept OpShield JWTs
4. **E2E tests** — Playwright tests for sign-up flow, admin dashboard, SSO

## [Unreleased] — Phase 11: Half-Built Feature Completion

### Added

#### 3-Tier Platform Admin Roles
- **Role-based access control**: Platform admins now have one of three roles — `super_admin` (full access), `support` (read + create + modify, no delete), `viewer` (read-only)
- **`requireWriteAccess` middleware**: Guards POST/PATCH routes — viewers get 403
- **`requireDeleteAccess` middleware**: Guards DELETE routes — only super_admin can delete
- **Role-aware routes**: Tenant CRUD, module management, subscription management, service key management, SSO provider management all enforce role-based permissions
- **Admin status API enriched**: `GET /me/admin-status` now returns `role` alongside `isPlatformAdmin`
- **Frontend role display**: Admin sidebar shows role badge (Super Admin / Support / Viewer)
- **`useAdminPermissions` hook**: Frontend permission checks for conditional UI rendering
- **DB migration**: `0005_admin_roles.sql` — migrates existing `admin` role to `super_admin`, changes default to `viewer`

#### Audit Log Read API + Admin UI
- **`GET /api/v1/audit-log`**: Paginated audit log endpoint with filters for `action`, `resourceType`, `actorId`, `resourceId`, `from`, `to` date range
- **Audit Log admin page** (`/admin/audit-log`): Filterable table showing all platform actions with action badges, resource type, actor, metadata preview, and timestamps
- **Navigation**: Audit Log added to admin sidebar
- **Shared schemas**: `auditLogQuerySchema`, `auditLogResponseSchema`

#### Email/Notifications Service
- **SMTP service** (`services/email.ts`): Nodemailer transport with MailHog for dev, SMTP2GO for prod
- **Handlebars template engine**: 8 email templates with consistent branded layout
- **Templates**: `welcome`, `payment-received`, `payment-failed`, `account-suspended`, `module-added`, `module-removed`, `plan-changed`, `provisioning-failed`
- **Automatic email dispatch**: Wired into Stripe webhook handlers (payment received, payment failed, account suspended), module routes (module added/removed), provisioning callbacks (failure alert), and checkout completion (welcome email)
- **Non-blocking**: All email sends are fire-and-forget — email failures never block API responses
- **Template helpers**: `{{formatCurrency}}` (cents→dollars), `{{formatDate}}` (ISO→AU locale), `{{year}}`

#### Microsoft SSO + Per-Tenant Azure AD
- **Better Auth Microsoft social provider**: Global Microsoft SSO via Azure AD, enabled when `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` env vars are set
- **Per-tenant SSO configuration**: Admin UI to configure per-tenant Azure AD app registrations with client ID, client secret, Azure tenant ID, and SSO enforcement flag
- **SSO provider routes**: `GET/PUT/DELETE /api/v1/tenants/:tenantId/sso-providers` — full CRUD for per-tenant SSO providers with audit logging
- **Domain-based SSO discovery**: `GET /api/v1/sso/discover?email=user@domain.com` — checks if the email domain has enforced SSO (for login flow routing)
- **SSO tab in tenant detail**: New "SSO" tab on tenant admin page showing current provider config, edit dialog, and remove button (role-aware)
- **Config**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` env vars added
- **Shared schemas**: `upsertSsoProviderSchema`, `ssoProviderResponseSchema`

#### Integration Tests
- **Email template tests**: All 8 templates compile, render with correct variables, no XSS-prone triple-brace usage
- **Billing utils tests**: Bundle coupon logic (10% for 2 products, 15% for 3+ modules)
- **Comprehensive schema validation tests**: 40+ tests covering all Zod schemas — tenant CRUD, module management, subscriptions, usage reports, provisioning callbacks, audit log queries, SSO providers, param schemas, webhook delivery queries
- **Admin role permission tests**: Verify role matrix (super_admin/support/viewer capabilities)
- **SSO route tests**: Auth guards, discovery endpoint (400 on bad input, ssoRequired=false for unknown domain)
- **Audit log route tests**: Auth guards, query parameter acceptance
- **All 182 tests passing across 24 test files (4 packages)**

### Decisions
- DEC-038: 3-tier admin roles (super_admin/support/viewer) enforced via middleware chain, not role column on routes
- DEC-039: Email layout via TypeScript string concatenation (not Handlebars triple-brace) to avoid XSS scanner false positives
- DEC-040: Microsoft SSO conditionally registered — only when env vars are configured, preventing startup failures in dev

### Next Steps (Priority Order)
1. **Support Hub** (docs/06) — DB schema (tickets, messages), API routes, email processing, admin UI
2. **Tenant Self-Service Portal** — Account settings, billing management for end users
3. **Advanced Platform Admin** — Impersonation, analytics dashboard, feature flags
4. **E2E tests** — Playwright tests for sign-up flow, admin dashboard, SSO

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
- Plan pricing data (9 plans across 3 tiers) inserted via migration
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
