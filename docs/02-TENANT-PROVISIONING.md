# 02 — Tenant Provisioning

> How OpShield creates tenants, dispatches provisioning webhooks to products, tracks status, and manages the tenant lifecycle.

## Overview

When a customer signs up via the OpShield public website, OpShield orchestrates provisioning across multiple systems:

1. Creates the tenant record in OpShield's database
2. Creates a Stripe customer and subscription
3. Dispatches `tenant.created` webhooks to product backends
4. Products self-provision their database schemas
5. Products call back to OpShield to confirm success/failure
6. Sends welcome communications
7. Redirects the user to their product

**Key design decision (DEC-034):** OpShield never connects to product databases. Products self-provision via webhook. This keeps products autonomous and avoids tight coupling.

**Key design decision (DEC-035):** A 200 webhook response only means "received" — schema creation is async. Products must call the provisioning callback endpoint to report the final result.

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
│    ─ Create `tenants` record (status: onboarding)        │
│    ─ Create Stripe customer                              │
│    ─ Create Stripe subscription (items per module)       │
│    ─ Create `tenant_modules` records                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. DISPATCH PROVISIONING WEBHOOKS (per product)          │
│                                                          │
│  OpShield:                                               │
│    ─ Queries tenant modules grouped by product           │
│    ─ Upserts `tenant_provisioning` rows (status:         │
│      dispatched)                                         │
│    ─ Sends `tenant.created` webhook to each product      │
│      with payload: { name, plan, modules[], ownerInfo }  │
│    ─ If webhook delivery fails, marks status: failed     │
│                                                          │
│  Products (self-provision):                              │
│    ─ Receive `tenant.created` webhook                    │
│    ─ Create local tenant record                          │
│    ─ Run provisionTenantSchema() (CREATE SCHEMA,         │
│      migrations, seed data)                              │
│    ─ Call back: POST /tenants/:id/provisioning-callback  │
│      with { productId, success, error? }                 │
│                                                          │
│  OpShield updates:                                       │
│    ─ tenant_provisioning.status = success|failed         │
│    ─ tenant_provisioning.provisioned_at (on success)     │
│    ─ Audit log entry                                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 4. POST-PROVISIONING                                     │
│    ─ Update tenants.status = 'active'                    │
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

### Platform Admin API (authenticated via session)

```
POST /api/v1/tenants/:tenantId/provision
  Body: { ownerUserId?, ownerEmail?, ownerName? }
  → Dispatches tenant.created webhooks to all products with modules
  → Response: { results: [{ productId, status, error }] }

GET /api/v1/tenants/:tenantId/provisioning-status
  → Returns per-product provisioning status
  → Response: [{ id, tenantId, productId, status, attempts, lastError, provisionedAt, ... }]

POST /api/v1/tenants/:tenantId/retry-provisioning
  Body: { productId: "safespec" | "nexum" }
  → Re-dispatches webhook for a failed product
```

### Product-Facing API (authenticated via service API key)

```
POST /api/v1/tenants/:tenantId/provisioning-callback
  Header: x-product-api-key: <key>
  Body: { productId: "safespec" | "nexum", success: boolean, error?: string }
  → Product reports provisioning result back to OpShield

GET /api/v1/tenants/:tenantId/entitlements
  → Returns full product + module entitlement map (see doc 01)

POST /api/webhooks/stripe
  → Stripe webhook receiver (payment events)
```

### Webhook Payload Contract (tenant.created)

```json
{
  "id": "<delivery-uuid>",
  "event": "tenant.created",
  "tenantId": "<opshield-tenant-id>",
  "timestamp": "<iso>",
  "data": {
    "name": "Acme Corp",
    "plan": "active",
    "modules": ["nexum-core", "nexum-invoicing"],
    "ownerUserId": "<user-id>",
    "ownerEmail": "owner@acme.com",
    "ownerName": "John Doe"
  }
}
```

The `modules` array is filtered to only include modules for the target product.

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

## Database Architecture

OpShield only connects to its own database. Products provision their own schemas.

```
OpShield DB (opshield_dev) — direct access, owns this DB
SafeSpec DB (safespec_dev) — owned by SafeSpec, provisioned by SafeSpec on webhook
Nexum DB (nexum_dev) — owned by Nexum, provisioned by Nexum on webhook
```

**Per DEC-034:** OpShield never connects to product databases. Products self-provision via the `tenant.created` webhook and call back to confirm.

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
