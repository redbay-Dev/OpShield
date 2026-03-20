# Changelog

All notable changes to OpShield are documented here.

## [Unreleased] — Phase 3: Auth UI + Platform Admin Dashboard

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

### Known Issues
- `BETTER_AUTH_SECRET` in `.env.development` is placeholder — needs a proper 32+ char secret
- No Stripe integration yet (schema only)
- Entitlements API currently requires platform admin auth — needs service API key auth for product backends

### Next Steps (Priority Order)
1. **Module management API** — Endpoints to assign/revoke modules on tenants
2. **Service API key auth** — Allow SafeSpec/Nexum backends to call entitlements API without session cookies
3. **Tenant provisioning flow** — Schema creation in product databases. See `docs/02-TENANT-PROVISIONING.md`
4. **Stripe billing integration** — Connect plans to Stripe products/prices. See `docs/04-BILLING-PRICING-MODEL.md`
5. **Public website** — Marketing pages, pricing page, sign-up flow

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
