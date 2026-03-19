# OpShield — Project Overview

## PROJECT IDENTITY

| Field | Value |
|-------|-------|
| **Project Name** | OpShield |
| **Owner** | Ryan Stagg (Redbay Development) |
| **Date** | March 2026 |
| **Status** | Pre-development (scaffolding) |

---

## WHAT THIS PROJECT IS

OpShield is the **platform layer** for the Redbay product suite. It is not a user-facing product — it's the infrastructure that enables Nexum (operations) and SafeSpec (compliance) to be sold, provisioned, and managed independently or as a bundle.

### What OpShield Does

1. **Authentication** — Single Better Auth SSO instance trusted by all products
2. **Tenant Provisioning** — Creates tenant schemas in product databases when customers sign up
3. **Billing** — Stripe subscriptions, plan management, usage tracking, invoicing
4. **Public Website** — Marketing pages, pricing, sign-up flow, login with redirect
5. **Platform Admin** — Redbay staff dashboard for tenant management, analytics, support tools

### What OpShield Does NOT Do

- No business logic (doesn't know what a job, driver, hazard, or inspection is)
- No API brokering (products talk directly to each other)
- No data storage for product data (each product owns its own database)

---

## THE PRODUCT SUITE

```
┌──────────────────────────────────────────────────┐
│                    OpShield                       │
│  ──────────────────────────────────────────────   │
│  Auth · Provisioning · Billing · Admin · Website │
└────────────┬─────────────────┬───────────────────┘
             │                 │
       ┌─────▼─────┐    ┌─────▼─────┐
       │   Nexum   │    │ SafeSpec  │
       │ Operations│    │Compliance │
       │           │◄──►│           │
       └───────────┘    └───────────┘
```

### Nexum
- **What**: Multi-tenant SaaS for Australian transport, earthmoving, civil construction, and logistics
- **Features**: Jobs, scheduling, drivers, assets, contractors, pricing, invoicing, dockets, mobile app (DriverX)
- **Path**: `/home/redbay/Nexum-SaaS`
- **Ports**: API 3002, Frontend 5174

### SafeSpec
- **What**: WHS and NHVAS/HVA compliance management SaaS
- **Features**: Hazard registers, incident reporting, SWMS, inspections, fatigue management, audit preparation, PDF pre-fill
- **Path**: `/home/redbay/saas-project`
- **Ports**: API 3001, Frontend 5173

### Sales Model

| Configuration | What Customer Gets |
|--------------|-------------------|
| Nexum only | Operations platform, no compliance features |
| SafeSpec only | Compliance management, no operations features |
| Both (bundled) | Full suite — compliance data flows into operations, operational data flows into compliance |

---

## TECH STACK

Same stack as Nexum/SafeSpec for developer consistency:

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui |
| **Backend** | Node.js 24 LTS + Fastify 5 + TypeScript 5.9 |
| **Database** | PostgreSQL 15 (flat schema — OpShield is not multi-tenant) |
| **ORM** | Drizzle ORM 0.45 |
| **Auth** | Better Auth 1.5 (THE instance — products delegate to this) |
| **Billing** | Stripe Billing |
| **Email** | SMTP (MailHog dev, SMTP2GO prod) |
| **Monorepo** | pnpm 10 workspaces + Turborepo 2.8 |
| **Hosting** | DigitalOcean (Sydney region) |
| **Testing** | Vitest 4 + Playwright 1.58 |

### Resource Allocation

| Resource | Value |
|----------|-------|
| Database | `opshield_dev` (dev), `opshield` (prod) |
| Redis prefix | `opshield:` |
| API port | 3000 |
| Frontend port | 5170 |
| MinIO bucket | `opshield-dev` |

---

## DATABASE SCHEMA

OpShield uses a **flat schema** (no multi-tenancy — it IS the tenant manager).

### Core Tables

```
-- Better Auth tables (user, session, account, verification, two_factor)
-- These are THE auth tables for the entire platform

tenants
├── id (UUID)
├── company_name (text)
├── trading_name (text, nullable)
├── abn (text, nullable)
├── primary_contact_user_id → user.id
├── subscription_status (enum: trial, active, past_due, suspended, cancelled)
├── trial_ends_at (timestamp, nullable)
├── stripe_customer_id (text, nullable)
├── created_at
├── updated_at
└── deleted_at (soft delete)

tenant_products
├── id (UUID)
├── tenant_id → tenants.id
├── product_id → products.id
├── status (enum: provisioning, active, suspended, deprovisioned)
├── plan (text — e.g., "starter", "growth", "business", "enterprise")
├── stripe_subscription_id (text, nullable)
├── provisioned_at (timestamp, nullable)
├── schema_name (text — e.g., "tenant_abc123")
├── config (JSONB — product-specific settings)
├── created_at
└── updated_at

products
├── id (text — "nexum", "safespec")
├── name (text)
├── description (text)
├── base_url (text — e.g., "https://app.nexum.com.au")
├── api_url (text — e.g., "https://api.nexum.com.au")
├── active (boolean)
├── pricing_config (JSONB)
├── created_at
└── updated_at

tenant_users
├── id (UUID)
├── tenant_id → tenants.id
├── user_id → user.id
├── role (enum: owner, admin, member)
├── invited_at
├── accepted_at
├── created_at
└── updated_at

product_connections
├── id (UUID)
├── tenant_id → tenants.id
├── source_product_id → products.id
├── target_product_id → products.id
├── api_key_hash (text — HMAC key for inter-product webhooks)
├── status (enum: active, disabled)
├── created_at
└── updated_at
```

---

## BUILD PHASES

### Phase 1: Foundation (do first)
- Monorepo scaffold (same structure as Nexum/SafeSpec)
- Database schema + migrations
- Better Auth as THE auth instance
- Tenant + product CRUD API
- Basic provisioning (create tenant, create schema in product DB)

### Phase 2: Auth Extraction
- Move Better Auth tables from Nexum and SafeSpec to OpShield
- Update products to validate sessions against OpShield
- SSO works across all three projects

### Phase 3: Public Website
- Marketing pages (products, pricing, about)
- Sign-up flow with product selection
- Login with redirect to chosen product
- Account management (profile, billing)

### Phase 4: Billing (Stripe)
- Stripe customer creation on sign-up
- Subscription management (create, upgrade, downgrade, cancel)
- Webhook handling (payment_succeeded, payment_failed, subscription_cancelled)
- Plan enforcement (user limits, storage limits, feature gates)
- Invoice history

### Phase 5: Platform Admin
- Tenant management dashboard
- Revenue analytics (MRR, churn, growth)
- Usage tracking per tenant
- Support tools (impersonate, export, audit logs)
- Feature flags
- Product health monitoring

---

## KEY DESIGN PRINCIPLES

1. **Products are independent** — Nexum works without SafeSpec and vice versa. Both work without knowing OpShield exists (they just need an auth endpoint).

2. **OpShield is invisible** — Users log into "Nexum" or "SafeSpec". OpShield handles auth/billing behind the scenes. Users only see OpShield for sign-up and account management.

3. **No business logic in OpShield** — It knows tenants, products, subscriptions, and users. Nothing else.

4. **API-only integration** — Products never share database access. All inter-product communication via documented APIs with HMAC-signed webhooks.

5. **Australian data residency** — Everything stays in DigitalOcean Sydney. No exceptions.

---

## DOCUMENT NAVIGATION

| Doc | Description |
|-----|-------------|
| `00-PROJECT-OVERVIEW.md` | This file |
| `01-AUTH-ARCHITECTURE.md` | Better Auth SSO, session management, token validation |
| `02-TENANT-PROVISIONING.md` | How tenants are created and schemas provisioned |
| `03-BILLING-STRIPE.md` | Stripe integration, plans, webhooks |
| `04-PUBLIC-WEBSITE.md` | Marketing pages, sign-up flow |
| `05-PLATFORM-ADMIN.md` | Redbay staff dashboard |
| `06-TECHNICAL-ARCHITECTURE.md` | Infrastructure, deployment, monitoring |
| `DECISION-LOG.md` | All architectural decisions |

*Note: Docs 01-06 are planned but not yet written. This overview is the starting point.*

---

## RELATED PROJECTS

| Project | Path | Docs |
|---------|------|------|
| Nexum | `/home/redbay/Nexum-SaaS` | `docs/24-OPSHIELD-PLATFORM.md` |
| SafeSpec | `/home/redbay/saas-project` | `docs/24-OPSHIELD-PLATFORM.md` |
| Integration | Both repos | `docs/SAFESPEC-INTEGRATION-NOTE.md` |
