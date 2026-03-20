# Changelog

All notable changes to OpShield are documented here.

## [Unreleased]

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

### Known Issues
- Database migrations not yet generated or run (`pnpm db:generate` + `pnpm db:migrate` needed after schema review)
- Better Auth not yet configured (no auth routes, no session management)
- No Stripe integration yet (schema only)

### Next Steps (Priority Order)
1. **Better Auth setup** — Configure the SSO auth instance (email/password + TOTP 2FA + JWT/JWKS). This is OpShield's core function. See `docs/07-AUTH-ARCHITECTURE.md`.
2. **Generate and run database migrations** — Review schema, run `pnpm db:generate`, then `pnpm db:migrate`
3. **Auth routes** — Register Better Auth handler in Fastify, create `/api/auth/*` routes
4. **Frontend auth pages** — Login, register, 2FA setup flows
5. **Tenant provisioning API** — See `docs/02-TENANT-PROVISIONING.md`
