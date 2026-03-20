# Decision Log

Every architectural, product, and workflow decision is recorded here with rationale. Agents do not have memory between sessions — this log is how continuity is maintained.

---

## Format

```
### DEC-XXX: [Short title]
**Date:** YYYY-MM-DD
**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this option was chosen
**Alternatives considered:** What else was considered and why it was rejected
```

---

### DEC-001: OpShield as the central platform layer
**Date:** 2026-03-20
**Context:** Nexum (operations) and SafeSpec (compliance) are independent products that can be sold separately or bundled. Both currently embed their own Better Auth instances and tenant provisioning. A central platform is needed for unified auth, billing, provisioning, and management.
**Decision:** Create OpShield as a third project that owns authentication (single Better Auth SSO instance), tenant provisioning (creates schemas in product databases), billing (Stripe), public website (marketing/sign-up), and platform admin (Redbay staff dashboard). Products delegate auth to OpShield but retain their own business logic, databases, roles, and permissions.
**Rationale:** Extracting auth and billing to a platform layer avoids duplicating provisioning logic across products, enables true SSO, supports independent or bundled sales, and centralises Stripe billing. This is the standard multi-product SaaS pattern (Atlassian, Zoho, MYOB).
**Alternatives considered:** Keep auth embedded in each product (duplicate accounts); shared database between products (creates coupling); OpShield as API gateway (adds latency and single point of failure).

### DEC-002: Same tech stack as Nexum/SafeSpec
**Date:** 2026-03-20
**Context:** OpShield needs a tech stack. The team already knows Fastify + React + Drizzle + shadcn/ui from building Nexum and SafeSpec.
**Decision:** Use identical stack: React 19, Fastify 5, TypeScript 5.9, Drizzle ORM, Tailwind CSS 4, shadcn/ui, pnpm + Turborepo, Vitest, Playwright.
**Rationale:** Developer consistency. One person (Ryan + Claude) maintains all three projects. Different stacks would increase cognitive load and maintenance burden for zero benefit.
**Alternatives considered:** Next.js for the public website (SSR benefits for marketing pages, but adds a different framework to learn and maintain).

### DEC-003: Flat database schema (no multi-tenancy in OpShield)
**Date:** 2026-03-20
**Context:** Nexum and SafeSpec use schema-per-tenant. OpShield manages tenants — should it also be multi-tenant?
**Decision:** OpShield uses a flat/single schema. It is the tenant registry, not a tenant itself.
**Rationale:** OpShield has one "tenant" — Redbay. There's no scenario where OpShield itself needs multi-tenancy. The tenants table in OpShield represents customers across all products.
**Alternatives considered:** None — this is straightforward.

### DEC-004: API port 3000, frontend port 5170
**Date:** 2026-03-20
**Context:** SafeSpec uses 3001/5172, Nexum uses 3002/5171. Need non-conflicting ports.
**Decision:** OpShield API on 3000, frontend on 5170. Redis prefix `opshield:`, database `opshield_dev`.
**Rationale:** Port 3000 is the natural "platform" port. Frontend 5170 precedes both product frontends.
**Alternatives considered:** None — sequential numbering.

### DEC-005: SafeSpec as two separate purchasable modules (WHS + HVA)
**Date:** 2026-03-20
**Context:** SafeSpec covers two distinct compliance domains: Work Health & Safety (WHS) and Heavy Vehicle Accreditation (HVA/NHVAS). Not every customer needs both — a construction company may only need WHS, while a trucking company may only need HVA. Some (heavy haulage + construction) need both.
**Decision:** SafeSpec is sold as two independent modules: WHS and HVA Compliance. Each has its own pricing tiers. Fleet Maintenance is a premium add-on within HVA. Customers select one or both modules at sign-up. OpShield tracks module subscriptions via `tenant_modules` table. SafeSpec enforces module access at API middleware and frontend route guard levels.
**Rationale:** Forcing customers to pay for WHS when they only need fatigue management (or vice versa) would price out single-domain operators. Modular pricing aligns cost with value. Module enforcement prevents accidental access to unpaid features.
**Alternatives considered:** Sell SafeSpec as a single product with all features (simpler but overpriced for single-domain users); separate SafeSpec into two completely independent products (increases maintenance burden, loses shared worker/vehicle data).

### DEC-006: Nexum optional modules with cross-product dependency
**Date:** 2026-03-20
**Context:** Nexum has 11 optional modules beyond its core (Jobs, Scheduling, Business Entities, Dashboard). The "Compliance" module specifically integrates with SafeSpec for compliance status badges, pre-start checks, and licence/medical alerts.
**Decision:** Nexum core is always included. Optional modules are individually purchasable. The Compliance module has a cross-product dependency — it requires an active SafeSpec subscription (WHS and/or HVA). OpShield validates this dependency before enabling the module and disables it if SafeSpec is cancelled.
**Rationale:** Compliance data lives in SafeSpec. Without SafeSpec, there's nothing for Nexum's compliance features to display. Enforcing this at the platform level prevents broken UX and wasted subscription spend.
**Alternatives considered:** Allow compliance module without SafeSpec (shows empty/stub data — confusing); bundle SafeSpec into Nexum compliance module (creates hidden pricing complexity).

### DEC-007: Three-layer module enforcement (OpShield → Backend → Frontend)
**Date:** 2026-03-20
**Context:** Module access must be reliably enforced. A single layer of enforcement is insufficient — frontend-only checks can be bypassed, backend-only checks leave poor UX.
**Decision:** Module enforcement happens at three layers: (1) OpShield is the source of truth for entitlements, (2) Product backends enforce via API middleware (403 for unsubscribed modules), (3) Product frontends hide UI and show upgrade prompts. Backend enforcement is the security boundary — frontend is cosmetic convenience.
**Rationale:** Defence in depth. The backend must never trust the frontend. OpShield must never trust products to self-enforce. Each layer serves a different purpose: OpShield tracks billing truth, backend enforces security, frontend provides UX.
**Alternatives considered:** Frontend-only enforcement (insecure — API still accessible); single centralized check in OpShield per request (adds latency, creates single point of failure).

### DEC-009: Base + per-user pricing model
**Date:** 2026-03-20
**Context:** Need a pricing model that works for solo operators (3 users) and mid-size companies (50+ users) without pricing out small customers or leaving money on the table with large ones.
**Decision:** Every module has a base price that includes N users (e.g., 5 for Starter). Additional users are charged per-user per month. Nexum optional modules are flat add-ons that share the Core module's user allocation. Bundle discounts apply when a tenant subscribes to both products. Annual billing gets 2 months free.
**Rationale:** Base + per-user is the standard SaaS pricing model (Atlassian, Slack, etc.). Included users remove friction at the low end. Per-user scaling captures value at the high end. Flat module add-ons keep Nexum simple — no separate user counts per module.
**Alternatives considered:** Flat pricing per tier with hard user caps (punishes growth, forces awkward tier jumps); pure per-user pricing (no base = looks expensive for 1-2 users); vehicle-based pricing for HVA (users rejected — some vehicles have multiple drivers, some drivers use multiple vehicles).

### DEC-010: OpShield does not manage product users
**Date:** 2026-03-20
**Context:** OpShield could centrally manage all user accounts across products, or it could delegate user management to each product.
**Decision:** Each product manages its own users, roles, and permissions. OpShield only tracks user counts (seats used vs seats purchased) for billing purposes. OpShield's billing dashboard shows licence usage but links out to the product for actual user management.
**Rationale:** Products have fundamentally different role models — Nexum has dispatcher/finance/compliance, SafeSpec has safety_officer/supervisor/worker. Centralising user management in OpShield would require OpShield to understand product-specific roles, violating the "no business logic in OpShield" principle. Products are the authority on who their users are and what they can do. OpShield is the authority on how many seats are paid for.
**Alternatives considered:** Full central user management in OpShield (creates coupling, requires OpShield to know about dispatchers and safety officers); hybrid where OpShield creates the user and products assign roles (complex, two-step invite flow, confusing for tenants).

### DEC-008: Module entitlements cached with webhook invalidation
**Date:** 2026-03-20
**Context:** Products need to check module access on every request. Calling OpShield on every request adds latency and creates a dependency.
**Decision:** Products cache entitlements in Redis (TTL: 15 minutes). OpShield sends HMAC-signed webhooks when module status changes, which immediately invalidate the cache. Auth validation is cached separately (TTL: 5 minutes).
**Rationale:** Balances performance (no per-request calls to OpShield) with freshness (webhook-driven invalidation means changes propagate in seconds, not minutes). TTL provides fallback if webhook delivery fails.
**Alternatives considered:** No caching (too much latency); long TTL without webhooks (stale data for up to an hour after module changes); embed entitlements in JWT (token bloat, complex refresh logic).

### DEC-011: Centralized support hub in OpShield
**Date:** 2026-03-20
**Context:** Tenants using SafeSpec or Nexum need a way to get support. Support could live in each product, or be centralized.
**Decision:** OpShield is the single support hub for all products. Users submit tickets from within any product (via email or API). OpShield processes inbound emails, creates tickets with full tenant context (company, plan, modules, user role), and provides a ticket management dashboard in Platform Admin. Users interact via email — they never need to log into OpShield for support.
**Rationale:** Centralizing support gives one view of all tickets across all products, avoids duplicating ticketing logic in SafeSpec and Nexum, and enriches tickets with billing/subscription context that products don't have. Email-based interaction is zero-friction for users — no new tool to learn. Admin gets full tenant context for fast triage (one-click impersonation, subscription details, module info).
**Alternatives considered:** Third-party helpdesk (Zendesk, Freshdesk — adds external dependency and cost, loses tight integration with tenant data); support in each product separately (duplicated effort, no cross-product visibility); shared inbox without ticketing (no tracking, no SLA, no metrics).

### DEC-012: Email-first support with API fallback
**Date:** 2026-03-20
**Context:** How should support tickets flow from products to OpShield?
**Decision:** Primary channel is email — products send structured emails to `support@redbay.com.au` with custom headers for automatic parsing. OpShield processes inbound emails (via email provider webhook) to create/update tickets. API endpoint exists as fallback for real-time submission. User replies to response emails are threaded back into the ticket automatically.
**Rationale:** Email is universally understood, works when OpShield API is down, and gives users a natural reply mechanism. Custom headers (`X-Redbay-Product`, `X-Redbay-Tenant-Id`) allow automatic enrichment without requiring the user to provide context manually. API fallback ensures tickets can still be created if email infrastructure has issues.
**Alternatives considered:** API-only (fails if OpShield is down, users can't reply naturally); in-app chat (requires WebSocket infrastructure, real-time staffing); form-only without email threading (users lose context, have to log in to check status).

### DEC-013: JWT/JWKS for cross-domain auth (not shared cookies)
**Date:** 2026-03-20
**Context:** SafeSpec and Nexum are on different domains (app.safespec.com.au vs app.nexum.com.au). Browser cookies cannot be shared across different domains. We need SSO without a shared cookie.
**Decision:** OpShield issues signed JWT access tokens via Better Auth's JWT plugin. Products validate tokens locally using OpShield's JWKS endpoint (/.well-known/jwks.json) — no per-request callback to OpShield. JWTs are short-lived (1 hour), audience-scoped (a Nexum token can't be used in SafeSpec), and products create their own local session cookies after validation.
**Rationale:** Stateless validation via JWKS is the industry standard for cross-domain SSO (same pattern as Auth0, Okta, Keycloak). No per-request call to OpShield means products aren't bottlenecked by auth service latency. Audience scoping prevents token misuse across products.
**Alternatives considered:** Shared session store in Redis (products would need shared Redis access — tight coupling); OpShield as OAuth2 provider with authorization code flow (more complex, Better Auth's JWT plugin achieves the same result more simply); cookie on shared parent domain (would require all products on subdomains of one domain — constrains branding).

### DEC-014: Mandatory 2FA with 30-day device trust
**Date:** 2026-03-20
**Context:** These products handle sensitive compliance and financial data. 2FA is mandatory for security. But requiring TOTP on every login creates friction that users will resent.
**Decision:** All users must enable TOTP-based 2FA. Devices can be trusted for 30 days — after initial 2FA verification, the device is remembered and subsequent logins skip the 2FA prompt. Trust period refreshes on each successful login. New/untrusted devices always require 2FA.
**Rationale:** 30-day device trust matches the balance between security and usability. Users on their regular work computer authenticate with 2FA once per month. Login from a new device (or someone else's computer) always requires 2FA. Better Auth's 2FA plugin supports this natively via `trustDevice: true`.
**Alternatives considered:** 2FA on every login (too much friction, users will complain); optional 2FA (not acceptable for compliance/financial data); SMS-based 2FA (less secure than TOTP, carrier-dependent, costs per message); WebAuthn/passkeys (Better Auth supports it, but not all users have compatible devices — can add as future option alongside TOTP).

### DEC-015: Microsoft SSO with per-tenant Azure AD support
**Date:** 2026-03-20
**Context:** Many target customers (transport companies, construction firms) use Microsoft 365. Supporting Microsoft SSO reduces onboarding friction and lets companies enforce their own identity policies.
**Decision:** OpShield supports Microsoft SSO via Better Auth's social provider plugin. Additionally, enterprise tenants can connect their own Azure AD tenant via the SSO plugin — employees authenticate against their company's Azure AD directory. Per-tenant SSO configuration is stored in `tenant_sso_providers` table. Tenants can optionally enforce SSO-only login (disable email/password).
**Rationale:** Microsoft is dominant in the Australian enterprise/SME space. Per-tenant Azure AD support is a significant enterprise selling point — IT admins can manage access via their existing identity tools, enforce their own MFA policies, and auto-deprovision users. Better Auth supports this natively.
**Alternatives considered:** Only global Microsoft SSO without per-tenant config (insufficient for enterprise customers who want their own directory); Google Workspace SSO instead (less dominant in target market, but can be added later); roll our own SAML implementation (unnecessary — Better Auth's SSO plugin handles this).

### DEC-016: Dual-auth migration strategy (not big-bang cutover)
**Date:** 2026-03-20
**Context:** SafeSpec and Nexum both have embedded Better Auth instances with existing user tables. Moving to OpShield's centralized auth requires migrating users without disruption.
**Decision:** Use a dual-auth transition period: products accept BOTH their embedded auth sessions AND OpShield JWTs simultaneously. New sign-ups go through OpShield. Existing users continue with embedded auth until migrated. User IDs are preserved (same UUIDs) to avoid updating foreign key references. Product auth tables are kept for 30 days after cutover as rollback safety net.
**Rationale:** Big-bang cutover risks locking out all users if something goes wrong. Dual-auth allows gradual migration with zero downtime. Preserving user IDs is critical — every audit log entry, tenant_users record, and document ownership reference uses the user UUID.
**Alternatives considered:** Big-bang migration on a weekend (risky, no rollback path if auth breaks); run both auth systems permanently (maintenance burden, confusing); create new user IDs in OpShield and update all references (massive migration, error-prone).

### DEC-017: Shared types package (@redbay/platform-types)
**Date:** 2026-03-20
**Context:** OpShield, SafeSpec, and Nexum all need to agree on types for entitlements responses, webhook payloads, support tickets, and module IDs. Without shared types, interfaces drift apart across repos.
**Decision:** Create a `@redbay/platform-types` package in OpShield's monorepo containing Zod schemas and TypeScript types for all platform API contracts. Products consume this package via workspace path or private registry. Type changes follow semver — breaking type changes require a major version bump.
**Rationale:** Single source of truth for the platform contract. TypeScript compiler catches breaking changes at build time rather than runtime. Zod schemas are used for runtime validation in both OpShield (response) and products (request parsing).
**Alternatives considered:** Copy types manually to each repo (drift guaranteed); generate types from OpenAPI spec (adds tooling complexity, loses Zod integration); share via git submodule (poor DX, merge conflicts).

### DEC-018: API versioning with URL prefix (v1)
**Date:** 2026-03-20
**Context:** The platform APIs (entitlements, support, webhooks) are contracts between OpShield and products. Breaking changes would break products.
**Decision:** All platform APIs use URL-prefixed versioning (`/api/v1/...`). Non-breaking changes (new optional fields, new endpoints) don't require version bumps. Breaking changes require a new version with 6-month deprecation period for the old version. Changes logged in `docs/API-CHANGELOG.md`.
**Rationale:** URL-prefixed versioning is simple, explicit, and cacheable. The 6-month deprecation window gives time to update products. Since Ryan maintains all three codebases, the deprecation period is more about not having to update everything simultaneously than about external API consumers.
**Alternatives considered:** No versioning (fragile — any change can break products); header-based versioning (harder to debug, less visible); per-endpoint versioning (inconsistent).

### DEC-019: Monorepo scaffold matching Nexum/SafeSpec patterns
**Date:** 2026-03-20
**Context:** OpShield needs a runnable project. The team already uses a proven monorepo pattern across Nexum and SafeSpec.
**Decision:** Scaffold OpShield as a pnpm 10 + Turborepo 2.8 monorepo with four packages: `@opshield/backend` (Fastify 5), `@opshield/frontend` (React 19 + Vite 8), `@opshield/shared` (internal types/schemas/constants), and `@redbay/platform-types` (cross-product contract types). All versions, configs, and conventions match Nexum exactly.
**Rationale:** Identical tooling across all three projects reduces cognitive load. The shared package handles internal concerns while platform-types is the external contract consumed by SafeSpec and Nexum.
**Alternatives considered:** None — consistency with existing projects is the obvious choice.

### DEC-020: No tenantId on user table — multi-tenant via join table
**Date:** 2026-03-20
**Context:** SafeSpec has `tenantId` directly on the `user` table, but OpShield users (e.g., contractors, consultants) may belong to multiple tenants.
**Decision:** Use a `tenant_users` join table with unique constraint on (userId, tenantId) instead of a direct FK on user. JWT payload includes `tenant_memberships` array.
**Rationale:** Supports multi-tenant membership without denormalization. The join table also stores the user's role per tenant.
**Alternatives considered:** tenantId on user with a separate membership table — rejected as redundant and confusing about source of truth.

### DEC-021: EdDSA/Ed25519 for JWT signing via Better Auth JWT plugin
**Date:** 2026-03-20
**Context:** Cross-domain SSO requires JWT tokens that SafeSpec and Nexum can verify without calling OpShield.
**Decision:** Use Better Auth's JWT plugin with JWKS endpoint at `/.well-known/jwks.json`. JWT issuer is "opshield", expiration 1 hour.
**Rationale:** EdDSA/Ed25519 is fast, compact, and the Better Auth default. JWKS endpoint follows standard OAuth 2.0/OIDC conventions.
**Alternatives considered:** Symmetric HMAC signing — rejected because products would need the shared secret, increasing blast radius of a key compromise.

### DEC-022: Per-route getSession() calls (not global auth hook)
**Date:** 2026-03-20
**Context:** Need to decide whether auth is checked globally or per-route.
**Decision:** Use per-route `getSession()` calls and a `requirePlatformAdmin` preHandler hook, matching SafeSpec's pattern.
**Rationale:** Some routes (health, JWKS, auth endpoints) must be public. Per-route is explicit, easier to reason about, and consistent with SafeSpec.
**Alternatives considered:** Global `onRequest` hook with exclusion list — rejected as harder to maintain and error-prone.

### DEC-023: @fastify/helmet for security headers
**Date:** 2026-03-20
**Context:** Need standard security headers (CSP, X-Frame-Options, etc.).
**Decision:** Register `@fastify/helmet` with CSP disabled in development.
**Rationale:** Industry standard, minimal config, covers OWASP header recommendations.
**Alternatives considered:** Manual header setting — rejected as error-prone and harder to maintain.

### DEC-024: Better Auth React client with origin-based baseURL
**Date:** 2026-03-20
**Context:** Frontend needs to call Better Auth APIs. Better Auth's `createAuthClient` requires a full URL with protocol, but the Vite proxy handles `/api` routing in dev.
**Decision:** Use `window.location.origin + "/api/auth"` as the baseURL, falling back to `http://localhost:5170/api/auth` for test environments.
**Rationale:** Deployment-agnostic — works with any domain. A relative path fails Better Auth's URL validation. Hardcoding the backend URL would break in production.
**Alternatives considered:** Hardcoded backend URL (breaks in production); environment variable (extra config for something derivable).

### DEC-025: Admin status check via dedicated API endpoint
**Date:** 2026-03-20
**Context:** Frontend needs to know if the logged-in user is a platform admin to gate dashboard access.
**Decision:** Created `GET /api/v1/me/admin-status` returning `{ isPlatformAdmin: boolean }`. Cached 5 minutes client-side.
**Rationale:** Avoids exposing `platform_admins` table structure. Separates admin check from session check (Better Auth doesn't know about platform admins).
**Alternatives considered:** Embed admin status in JWT payload (token bloat, requires Better Auth customization); catch 403 on admin endpoints (fragile UX).

### DEC-026: Cross-product dependency enforcement in module management
**Date:** 2026-03-20
**Context:** Nexum's Compliance module requires an active SafeSpec subscription (WHS or HVA). This dependency needs enforcement when adding or removing modules.
**Decision:** Module management API enforces dependencies bidirectionally: (1) Adding `nexum-compliance` requires at least one active SafeSpec module on the tenant. (2) Removing a SafeSpec module is blocked if it's the last active SafeSpec module and `nexum-compliance` is active. Hard delete (not soft delete) for module removal — modules are entitlements, not records with history.
**Rationale:** Prevents broken states where Nexum Compliance has no SafeSpec data to display. Hard delete is appropriate because module entitlements are a current-state table, not an audit trail (audit log records all changes separately).
**Alternatives considered:** Soft delete with status "removed" (complicates re-addition logic); cascading removal of Nexum Compliance when last SafeSpec module removed (too aggressive — admin should make that decision explicitly).

### DEC-027: SHA-256 for service API key hashing (not bcrypt)
**Date:** 2026-03-21
**Context:** Service API keys need to be stored securely. bcrypt is standard for passwords, but API keys have different characteristics.
**Decision:** Hash service API keys with SHA-256 and use constant-time comparison via `timingSafeEqual`. Store only the hash and an 8-character prefix for identification in logs/UI.
**Rationale:** API keys are high-entropy random strings (32 bytes / 64 hex chars), not user-chosen passwords. SHA-256 is sufficient because the key space is too large for brute-force attacks. bcrypt's intentional slowness would add unnecessary latency to every authenticated API call. The key prefix allows admins to identify which key is in use without exposing the full key.
**Alternatives considered:** bcrypt (unnecessary latency for high-entropy keys); Argon2 (same issue); storing keys in plaintext (insecure — database breach would expose all keys).

### DEC-028: Dual-mode authentication middleware for entitlements API
**Date:** 2026-03-21
**Context:** The entitlements API needs to be callable by both platform admins (browser sessions) and product backends (API keys). Two separate endpoints would duplicate logic.
**Decision:** Created `requireServiceAuth` middleware that accepts either `x-product-api-key` header or a platform admin session cookie. When called via service key, the entitlements response is automatically scoped to the calling product's modules.
**Rationale:** Single endpoint, dual auth keeps the API surface clean. Product scoping prevents SafeSpec from seeing Nexum's modules and vice versa, following principle of least privilege. Platform admins see all modules since they manage the entire platform.
**Alternatives considered:** Separate endpoints per auth method (duplicated route logic); always return all modules (violates least privilege for service keys); separate middleware chain per auth type on same route (Fastify preHandler doesn't support OR logic natively).

### DEC-029: One subscription per tenant (not per product)
**Date:** 2026-03-21
**Context:** Tenants can subscribe to SafeSpec modules, Nexum modules, or both. Should each product have its own Stripe subscription, or one subscription per tenant?
**Decision:** One Stripe subscription per tenant with multiple line items (one per module). Bundle discounts are applied as Stripe coupons on the single subscription.
**Rationale:** One subscription simplifies billing management — single invoice, single payment, single cancellation. Stripe supports multiple items per subscription natively. Bundle discounts are easier to apply as coupons on a single subscription than coordinating across multiple subscriptions. Platform admin can see the full billing picture in one place.
**Alternatives considered:** Subscription per product (two invoices, harder to apply bundle discounts); subscription per module (fragmented billing, too many subscriptions to manage).

### DEC-030: Webhook route in own Fastify scope for raw body parsing
**Date:** 2026-03-21
**Context:** Stripe webhook signature verification requires the raw request body (buffer). Fastify parses JSON by default, which modifies the body before the signature can be verified.
**Decision:** Register the Stripe webhook route in its own Fastify encapsulated scope with a custom content type parser that preserves the raw buffer. Registered before the `/api/v1` group at the app root level.
**Rationale:** Fastify's encapsulation model means the raw body parser only affects routes in the webhook scope — all other routes continue using normal JSON parsing. This is the documented pattern for Stripe webhook handling in Fastify.
**Alternatives considered:** Global raw body plugin (affects all routes, breaks normal JSON parsing); `preParsing` hook to save raw body (requires careful buffering, fragile); separate Express/Hono server for webhooks (unnecessary complexity).

### DEC-031: Standalone price sync script (not admin API)
**Date:** 2026-03-21
**Context:** Stripe prices need to be created and linked to plan records in the DB. This could be an API endpoint or a standalone script.
**Decision:** Standalone CLI script (`pnpm stripe:sync`) that reads plans from DB, creates Stripe products/prices, and updates plan records. Run manually after changing plan configuration.
**Rationale:** Price sync is a rare admin operation (only when plans change), not a runtime API call. A script is simpler, safer (no accidental triggers), and can be run with full visibility into what's being created. No auth/permission complexity needed.
**Alternatives considered:** Admin API endpoint (adds auth complexity for a rarely-used operation, risk of accidental invocation); manual Stripe dashboard configuration (error-prone, no DB sync, doesn't scale).

---
