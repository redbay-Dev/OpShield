# CLAUDE.md — OpShield Platform Guide for AI Agents

## Project Identity
- **Name**: OpShield
- **Owner**: Ryan Stagg (Redbay Development)
- **What**: Central platform layer for the Redbay product suite (Nexum + SafeSpec)
- **Role**: Authentication, tenant provisioning, billing, public website, platform admin
- **Architecture**: Same stack as Nexum/SafeSpec — Fastify, React, Drizzle, shadcn/ui

## Tech Stack
- **Frontend**: React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Node.js 24 LTS + Fastify 5 + TypeScript 5.9
- **Database**: PostgreSQL 15 (flat schema — NOT multi-tenant)
- **ORM**: Drizzle ORM 0.45
- **Auth**: Better Auth 1.5 (THE auth instance — email/password + Microsoft SSO + mandatory 2FA with 30-day device trust + JWT/JWKS for cross-domain validation)
- **Billing**: Stripe Billing
- **Validation**: Zod 4
- **Monorepo**: pnpm 10 workspaces + Turborepo 2.8
- **Hosting**: DigitalOcean (Sydney region)
- **Testing**: Vitest 4 + Playwright 1.58

## Project Structure
```
OpShield/
  packages/
    frontend/          # React + Vite (public website + admin dashboard)
    backend/           # Fastify (auth, provisioning, billing APIs)
    shared/            # Shared types, schemas, constants (internal)
    platform-types/    # @redbay/platform-types — shared contract types for SafeSpec/Nexum
  docs/                # Project documentation
  docker/              # Docker compose (if needed)
  scripts/             # Dev scripts, migrations
  .claude/
    commands/          # Slash commands
    skills/            # Agent skills
```

## Dev Environment
- **Ports**: API 3000, Frontend 5170
- **Database**: `opshield_dev` on shared PostgreSQL (port 5432)
- **Redis**: prefix `opshield:` on shared Redis (port 6379)
- **MinIO**: bucket `opshield-dev` on shared MinIO (port 9000)
- **Email**: MailHog on shared instance (port 1025/8025)
- Do NOT spin up duplicate Docker containers — use the shared ones
- Package manager: **pnpm 10** (not npm, not yarn)

## Product Suite
| Project | Path | API Port | Frontend Port |
|---------|------|----------|---------------|
| OpShield | `/home/redbay/OpShield` | 3000 | 5170 |
| SafeSpec | `/home/redbay/saas-project` | 3001 | 5173 |
| Nexum | `/home/redbay/Nexum-SaaS` | 3002 | 5174 |

## What OpShield Owns
1. **Auth (SSO)** — Single Better Auth instance, all products validate against this
2. **Tenant Provisioning** — Creates tenant records and schemas in product databases
3. **Billing (Stripe)** — Subscriptions, plans, usage tracking, invoicing
4. **Public Website** — Marketing, pricing, sign-up, login with redirect
5. **Platform Admin** — Redbay staff dashboard for managing everything
6. **Support Hub** — Centralized support ticketing for all products (email-based for users, dashboard for admin)

## What OpShield Does NOT Own
- **No user management** — Each product manages its own users/roles/permissions. OpShield only tracks user COUNTS for billing (licence seats used vs purchased).
- No business logic (doesn't know jobs, drivers, hazards, inspections)
- No API brokering (products talk directly to each other)
- No product data storage (each product owns its own DB)

## Pricing Model
- Base price per module + included users (e.g., 5) + per-user charge beyond that
- Nexum optional modules are flat add-ons (use Core's user allocation)
- SafeSpec WHS and HVA have independent user counts and tiers
- Bundle discount when tenant has both products
- Annual billing = 2 months free
- See `docs/04-BILLING-PRICING-MODEL.md` for full details

## Module Architecture (CRITICAL)
Products are modular — signing up does NOT grant access to everything:

**SafeSpec** has TWO separately purchasable modules:
- **WHS Module** — Work Health & Safety (hazards, incidents, SWMS, inspections, corrective actions)
- **HVA Module** — Heavy Vehicle Accreditation (fatigue, mass mgmt, fitness to drive, SMS builder, CoR)
- **Fleet Maintenance** — Premium add-on within HVA only
- Tenants choose WHS, HVA, or both. Features are gated per module.

**Nexum** has Core (always included) + 11 optional modules:
- Core: Jobs, Business Entities, Scheduling, Dashboard
- Optional: Invoicing, RCTI, Xero, Compliance, SMS, Dockets, Materials, Map Planning, AI, Reporting, Portal
- The `Compliance` module requires an active SafeSpec subscription

**Enforcement:** Three layers — OpShield (source of truth), Product Backend (403 middleware), Product Frontend (UI guards). See `docs/01-PRODUCT-MODULE-ARCHITECTURE.md`.

## Critical Rules

### TYPESCRIPT TYPE SAFETY (NEVER VIOLATE)
Same rules as Nexum/SafeSpec — see their CLAUDE.md for full details.
- `strict: true` — non-negotiable
- NEVER use `any`, `as` assertions, `@ts-ignore`, `!` non-null assertions
- Zod schemas are the single source of truth for types
- Every function has explicit return types

### Code Conventions
Same as Nexum/SafeSpec:
- **Files**: kebab-case | **Components**: PascalCase | **Functions**: camelCase
- **DB tables/columns**: snake_case | **API endpoints**: kebab-case
- **Imports**: Path aliases `@frontend/`, `@backend/`, `@shared/`
- Soft deletes only
- All routes have Zod validation

### Security
- Never log sensitive data
- Never store secrets in code
- All Stripe webhook signatures verified
- Auth tokens never exposed in URLs

### After Completing Any Task
1. Run: `pnpm lint && pnpm type-check && pnpm test`
2. ALL checks must pass
3. Update `CHANGELOG.md`
4. Update `docs/DECISION-LOG.md` if decisions were made
5. Commit with conventional format: `type(scope): description`

### Git Workflow
- `main` = production-ready
- `develop` = integration branch
- Feature branches: `feature/{short-description}`

## Key Documentation
| Doc | When to Read |
|-----|-------------|
| `docs/00-PROJECT-OVERVIEW.md` | Starting any work |
| `docs/01-PRODUCT-MODULE-ARCHITECTURE.md` | Module structure, enforcement, pricing |
| `docs/02-TENANT-PROVISIONING.md` | Tenant creation, schema provisioning |
| `docs/03-INTEGRATION-ARCHITECTURE.md` | How products communicate, webhook security |
| `docs/04-BILLING-PRICING-MODEL.md` | Pricing model, Stripe, user licensing |
| `docs/05-PLATFORM-ADMIN.md` | Redbay staff admin dashboard |
| `docs/06-SUPPORT-SYSTEM.md` | Support ticketing, email processing |
| `docs/07-AUTH-ARCHITECTURE.md` | SSO, 2FA, JWT/JWKS, Microsoft SSO, migration |
| `docs/08-NOTIFICATIONS-EMAIL.md` | Platform emails, billing alerts |
| `docs/09-PLATFORM-API-CONTRACTS.md` | API versioning, shared types, rate limits |
| `docs/DECISION-LOG.md` | All architectural decisions |
| Nexum platform doc | `/home/redbay/Nexum-SaaS/docs/24-OPSHIELD-PLATFORM.md` |
| SafeSpec platform doc | `/home/redbay/saas-project/docs/24-OPSHIELD-PLATFORM.md` |
| Integration doc | Both repos: `docs/SAFESPEC-INTEGRATION-NOTE.md` |
