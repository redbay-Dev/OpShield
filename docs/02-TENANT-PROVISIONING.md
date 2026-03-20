# 02 — Tenant Provisioning

> How OpShield creates tenants, provisions product databases, seeds module-specific data, and manages the tenant lifecycle.

## Overview

When a customer signs up via the OpShield public website, OpShield orchestrates provisioning across multiple systems:

1. Creates the tenant record in OpShield's database
2. Creates a Stripe customer and subscription
3. Provisions database schemas in the relevant product database(s)
4. Seeds module-specific default data
5. Sends welcome communications
6. Redirects the user to their product

---

## Provisioning Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. SIGN-UP (OpShield Frontend)                           │
│    User fills: company name, ABN, contact details,       │
│    selects products + modules, chooses plans, enters      │
│    payment via Stripe Elements                            │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 2. CREATE TENANT (OpShield Backend)                      │
│    ─ Validate input (Zod)                                │
│    ─ Create `tenants` record (status: provisioning)      │
│    ─ Create `tenant_users` record (role: owner)          │
│    ─ Create Stripe customer                              │
│    ─ Create Stripe subscription (items per module)       │
│    ─ Create `tenant_products` records                    │
│    ─ Create `tenant_modules` records                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. PROVISION PRODUCT DATABASES (async, per product)      │
│                                                          │
│  For SafeSpec (if selected):                             │
│    ─ Connect to SafeSpec's PostgreSQL                    │
│    ─ CREATE SCHEMA tenant_{uuid}                         │
│    ─ Run SafeSpec tenant migration (tables, indexes)     │
│    ─ Seed data based on active modules:                  │
│      ─ WHS: default inspection templates, risk matrix    │
│      ─ HVA: default fatigue rules, SMS templates         │
│      ─ Both: cross-module defaults                       │
│    ─ Update tenant_products.status = 'active'            │
│    ─ Update tenant_products.provisioned_at               │
│    ─ Update tenant_products.schema_name                  │
│                                                          │
│  For Nexum (if selected):                                │
│    ─ Connect to Nexum's PostgreSQL                       │
│    ─ CREATE SCHEMA tenant_{uuid}                         │
│    ─ Run Nexum tenant migration (tables, indexes)        │
│    ─ Seed data based on enabled modules                  │
│    ─ Set enabled_modules array in organisation config     │
│    ─ Update tenant_products.status = 'active'            │
│                                                          │
│  If both products:                                       │
│    ─ Create product_connections record                   │
│    ─ Generate HMAC API key for inter-product webhooks    │
│    ─ Register webhook endpoints in both products         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 4. POST-PROVISIONING                                     │
│    ─ Update tenants.subscription_status = 'active'       │
│      (or 'trial' if trial period)                        │
│    ─ Send welcome email with login URL(s)                │
│    ─ Create audit log entry                              │
│    ─ Redirect user to primary product                    │
└──────────────────────────────────────────────────────────┘
```

---

## Module-Specific Seeding

When provisioning a SafeSpec tenant schema, the seed data depends on which modules are active:

### WHS Module Seed Data
- Default risk matrix (5x5 likelihood × consequence)
- Default inspection templates (workplace, fire safety, first aid)
- Default hazard categories
- Default incident types and severity levels
- Default corrective action priorities
- Australian jurisdiction defaults (based on company state)
- Sample SWMS template structure

### HVA Module Seed Data
- BFM/AFM fatigue rule definitions (from HVNL)
- Default SMS (Safety Management System) template sections
- Default audit checklist items (aligned to NHVR audit criteria)
- Vehicle inspection categories
- Chain of Responsibility duty categories
- Mass management limits (GML, HML, CML thresholds)
- Default fitness-to-drive medical categories

### Nexum Module Seed Data
- Default job statuses and workflow
- Default role definitions and permissions
- If compliance module enabled: default compliance check categories

---

## Tenant Status Lifecycle

```
provisioning → trial → active → past_due → suspended → cancelled
                 │                                         │
                 └─── active (after payment) ───────────►──┘
                                                    (reactivation)
```

| Status | Meaning | Product Behaviour |
|--------|---------|-------------------|
| `provisioning` | Schema being created | User sees "Setting up your account..." spinner |
| `trial` | Free trial active | Full access, trial badge shown, days remaining counter |
| `active` | Paid subscription | Full access |
| `past_due` | Payment failed | Full access for grace period (7 days), warning banners |
| `suspended` | Payment failed beyond grace | Read-only access, cannot create new records |
| `cancelled` | Subscription ended | No access, data retained for 90 days |

---

## Adding Products/Modules to Existing Tenant

After initial sign-up, tenants can add products or modules through the OpShield billing portal:

### Adding a New Product
1. Tenant clicks "Add Product" in account management
2. Selects product + modules + plan
3. Stripe subscription updated (new line items)
4. OpShield provisions new product database schema
5. Webhook notifies existing product(s) about the new connection

### Adding a Module to Existing Product
1. Tenant clicks "Add Module" on their subscription page
2. Selects module + plan tier
3. Stripe subscription updated
4. OpShield creates `tenant_modules` record
5. Webhook notifies product: `module.activated`
6. Product enables module features (no schema change needed — all tables already exist, just gated by module access)

### Removing a Module
1. Tenant clicks "Remove Module"
2. Confirmation: "Your data will be retained for 90 days"
3. Stripe subscription updated (item removed)
4. OpShield updates `tenant_modules.status = 'cancelled'`
5. Webhook notifies product: `module.cancelled`
6. Product disables module features, data remains but is inaccessible

---

## Provisioning API Endpoints

### Internal API (OpShield Backend)

```
POST /api/internal/tenants
  Body: { company_name, abn, contact, products: [{ id, plan, modules: [...] }] }
  Response: { tenant_id, status: "provisioning" }

GET /api/internal/tenants/:id/provisioning-status
  Response: { status, products: [{ id, status, provisioned_at }] }

POST /api/internal/tenants/:id/products
  Body: { product_id, plan, modules: [...] }
  → Add product to existing tenant

POST /api/internal/tenants/:id/modules
  Body: { product_id, module_id, plan }
  → Add module to existing product subscription

DELETE /api/internal/tenants/:id/modules/:moduleId
  → Cancel module (soft — marks as cancelled)

POST /api/internal/tenants/:id/suspend
  → Suspend tenant (payment failure)

POST /api/internal/tenants/:id/reactivate
  → Reactivate after payment
```

### Product-Facing API

```
GET /api/tenants/:id/entitlements
  → Returns full product + module entitlement map (see doc 01)

POST /api/webhooks/stripe
  → Stripe webhook receiver (payment events)
```

---

## Error Handling

### Provisioning Failure
If schema creation fails mid-provisioning:
1. Mark `tenant_products.status = 'provisioning_failed'`
2. Log error with full context
3. Alert platform admin
4. Offer manual retry in admin dashboard
5. Do NOT charge the customer (Stripe trial or delay capture)

### Partial Provisioning
If a tenant buys both SafeSpec and Nexum but one fails:
1. Successfully provisioned product remains accessible
2. Failed product shows "Setting up..." with error context
3. Platform admin can retry the failed provisioning
4. Stripe subscription includes both — refund if not resolved within 24 hours

---

## Database Connections

OpShield needs database connections to provision schemas in product databases:

```
OpShield DB (opshield_dev) — direct access, owns this DB
SafeSpec DB (safespec_dev) — provisioning-only connection (CREATE SCHEMA, run migrations)
Nexum DB (nexum_dev) — provisioning-only connection (CREATE SCHEMA, run migrations)
```

**Security:** The provisioning connection uses a dedicated database role with limited permissions:
- `CREATE SCHEMA`
- `CREATE TABLE` (within new schemas only)
- `INSERT` (for seed data only)
- No `DROP`, no `DELETE`, no access to existing tenant schemas

---

## Deprovisioning

When a tenant is permanently deleted (after 90-day retention):

1. Platform admin initiates deprovisioning
2. OpShield marks tenant as `deprovisioned`
3. Product schemas are exported (backup) then dropped
4. Stripe customer archived
5. PII scrubbed from OpShield records (company name retained for audit trail)
6. Audit log entry created (immutable)

**This is an irreversible operation.** Requires platform admin confirmation with reason.
