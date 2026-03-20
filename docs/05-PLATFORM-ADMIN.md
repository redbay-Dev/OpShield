# 05 — Platform Admin Dashboard

> The Redbay staff dashboard for managing all tenants, products, billing, and system health across the entire platform.

## Overview

The Platform Admin is a **Redbay-internal** dashboard built into OpShield's frontend. It is not visible to tenants. It gives Redbay staff (currently Ryan, potentially future support/ops staff) full visibility and control over every tenant, subscription, product, and system across the entire Redbay suite.

This is the **single pane of glass** for managing SafeSpec, Nexum, and OpShield itself.

---

## Access Control

### Platform Admin Role

Platform admins are stored in OpShield's `platform_admins` table — completely separate from tenant user roles.

```
platform_admins
├── id (UUID)
├── user_id → user.id (Better Auth user)
├── role (enum: super_admin, support, viewer)
├── created_at
└── updated_at
```

| Role | Capabilities |
|------|-------------|
| **super_admin** | Full access — everything below. Can create other platform admins. |
| **support** | Read all tenant data, impersonate tenants, manage subscriptions. Cannot delete tenants or modify platform config. |
| **viewer** | Read-only access to dashboards and analytics. Cannot modify anything. |

Ryan is `super_admin`. Future support staff would be `support` or `viewer`.

### Auth Flow

```
1. User logs into OpShield (same Better Auth login as everyone)
2. OpShield checks: is this user_id in platform_admins?
3. If yes → show admin sidebar/nav alongside any tenant context
4. If no → normal tenant user experience (billing, account management only)
5. Platform admin routes are protected by middleware:
   requirePlatformAdmin('super_admin') or requirePlatformAdmin('support')
```

Platform admin access is **in addition to** any tenant membership the user might have. Ryan can be a platform admin AND a member of a test tenant.

---

## Dashboard Sections

### 1. Tenant Management

The central hub for managing all customers across all products.

#### Tenant List View
```
┌─────────────────────────────────────────────────────────────────┐
│ Tenants (247 total)                    [+ Create] [Export CSV]  │
│                                                                  │
│ Search: [________________]  Status: [All ▼]  Product: [All ▼]  │
│                                                                  │
│ Company          │ Status  │ Products       │ Users │ MRR       │
│ ─────────────────┼─────────┼────────────────┼───────┼────────── │
│ Smith Haulage    │ Active  │ Nexum, SS-WHS  │ 18    │ $347/mo   │
│ BridgeCo Civil   │ Active  │ SS-WHS+HVA     │ 42    │ $276/mo   │
│ Outback Transport│ Trial   │ Nexum, SS-HVA  │ 6     │ —         │
│ Metro Earthworks │ Past Due│ SS-WHS         │ 12    │ $64/mo    │
│ Pacific Logistics│ Susp.   │ Nexum          │ 0     │ $0        │
└─────────────────────────────────────────────────────────────────┘
```

#### Tenant Detail View

Clicking a tenant opens a full management panel:

```
┌─────────────────────────────────────────────────────────────────┐
│ Smith Haulage Pty Ltd                              [Impersonate]│
│ ABN: 12 345 678 901 │ Status: Active │ Since: 2026-01-15       │
│                                                                  │
│ ┌─── Subscription ──────────────────────────────────────────┐   │
│ │                                                            │   │
│ │ Nexum Core (Professional)           $179/mo + 3 extra = $197│  │
│ │   Users: 18/15 included (3 extra × $6)                     │  │
│ │   Modules: Invoicing ($29), RCTI ($19), Dockets ($19)      │  │
│ │   [Change Plan] [Add Module] [Remove Module]               │  │
│ │                                                            │   │
│ │ SafeSpec WHS (Starter)              $49/mo + 0 extra = $49 │  │
│ │   Users: 5/5 included                                      │  │
│ │   [Change Plan] [Add Module]                               │  │
│ │                                                            │   │
│ │ Bundle discount (10%): -$36.20                             │  │
│ │ Monthly total: $326.80 (excl. GST)                         │  │
│ │                                                            │   │
│ │ [View Stripe Dashboard] [Apply Discount] [Override Limit]  │  │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── Products ──────────────────────────────────────────────┐   │
│ │                                                            │   │
│ │ Nexum                                                      │   │
│ │   Schema: tenant_abc123 in nexum DB                        │  │
│ │   Provisioned: 2026-01-15                                  │  │
│ │   Status: Active                                           │  │
│ │   [View in Nexum] [View Schema] [Suspend] [Deprovision]   │  │
│ │                                                            │   │
│ │ SafeSpec                                                   │   │
│ │   Schema: tenant_abc123 in safespec DB                     │  │
│ │   Provisioned: 2026-02-10                                  │  │
│ │   Status: Active                                           │  │
│ │   Modules: WHS ✓  HVA ✗  Fleet Maint ✗                    │  │
│ │   [View in SafeSpec] [View Schema] [Suspend]               │  │
│ │                                                            │   │
│ │ [+ Add Product]                                            │  │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── User Licences ─────────────────────────────────────────┐   │
│ │                                                            │   │
│ │ Nexum: 18 active users (15 included + 3 extra)             │  │
│ │   Breakdown: 1 owner, 2 admin, 8 dispatch, 4 fin, 3 other │  │
│ │   Last reported: 2026-03-20 09:00                          │  │
│ │                                                            │   │
│ │ SafeSpec: 5 active users (5 included + 0 extra)            │  │
│ │   Breakdown: 1 owner, 1 admin, 2 safety_officer, 1 worker │  │
│ │   Last reported: 2026-03-20 09:00                          │  │
│ │                                                            │   │
│ │ Note: User management is done within each product.         │  │
│ │ [Open Nexum User Admin] [Open SafeSpec User Admin]         │  │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── Billing History ───────────────────────────────────────┐   │
│ │ 2026-03-01  Invoice #INV-0047  $359.48 incl GST    Paid   │  │
│ │ 2026-02-01  Invoice #INV-0031  $312.40 incl GST    Paid   │  │
│ │ 2026-01-15  Invoice #INV-0012  $197.12 incl GST    Paid   │  │
│ │ [View All] [View in Stripe]                                │  │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── Audit Log ─────────────────────────────────────────────┐   │
│ │ 2026-03-20 09:15  Module added: SafeSpec WHS              │   │
│ │ 2026-02-10 14:30  Product added: SafeSpec                 │   │
│ │ 2026-01-15 11:00  Tenant created, Nexum provisioned       │   │
│ │ [View Full Log]                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ⚠️ Danger Zone                                                   │
│ [Suspend Tenant] [Cancel Subscription] [Delete Tenant (90-day)] │
└─────────────────────────────────────────────────────────────────┘
```

#### Tenant Actions

| Action | Role Required | Effect |
|--------|--------------|--------|
| View tenant details | viewer+ | Read-only |
| Impersonate tenant | support+ | Log into product as if you were the tenant owner. Audit logged. |
| Change plan/modules | support+ | Updates Stripe subscription, notifies products |
| Apply discount/credit | support+ | Applies Stripe coupon or invoice credit |
| Override user limit | super_admin | Temporarily allow more users than plan includes |
| Suspend tenant | support+ | Disables access across all products, keeps data |
| Cancel subscription | support+ | Schedules cancellation at end of billing period |
| Reactivate tenant | support+ | Restores access, resumes billing |
| Delete tenant | super_admin | Starts 90-day countdown to permanent deletion |
| Force deprovision | super_admin | Immediately drops schemas (requires confirmation + reason) |

### 2. Revenue & Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Revenue Dashboard                              Period: [Mar 26] │
│                                                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│ │ MRR          │ │ Active       │ │ Churn Rate   │ │ ARPU    │ │
│ │ $24,780      │ │ Tenants: 247 │ │ 2.1%         │ │ $100.32 │ │
│ │ ▲ +8.2%      │ │ ▲ +12 this mo│ │ ▼ -0.3%      │ │ ▲ +$4   │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
│                                                                  │
│ Revenue by Product          │ Revenue by Module                  │
│ ┌─────────────────────────┐ │ ┌──────────────────────────────┐  │
│ │ Nexum:    $14,200 (57%) │ │ │ Nexum Core:     $8,900       │  │
│ │ SafeSpec: $10,580 (43%) │ │ │ Nexum Invoicing: $2,100      │  │
│ │                         │ │ │ SafeSpec WHS:   $6,200       │  │
│ │                         │ │ │ SafeSpec HVA:   $3,400       │  │
│ │                         │ │ │ ... (all modules)            │  │
│ └─────────────────────────┘ │ └──────────────────────────────┘  │
│                                                                  │
│ MRR Growth (12-month chart)                                     │
│ ████████████████████████████████████████████████████████          │
│                                                                  │
│ Trial Conversion                                                 │
│ Active trials: 18 │ Conversion rate: 34% │ Avg trial→paid: 8 days│
└─────────────────────────────────────────────────────────────────┘
```

#### Key Metrics

| Metric | Source | Calculation |
|--------|--------|-------------|
| MRR (Monthly Recurring Revenue) | Stripe | Sum of all active subscription amounts |
| Active Tenants | OpShield DB | Count of tenants with status = active |
| Churn Rate | Stripe + OpShield | Cancelled tenants / total at start of month |
| ARPU (Avg Revenue Per User) | Stripe | MRR / active tenants |
| Trial Conversion | OpShield | Trials → paid / total trials (30-day window) |
| Revenue by Product | Stripe | Sum of subscription items by product |
| Revenue by Module | Stripe | Sum of subscription items by module |
| User Licence Utilisation | Product reports | Active users / purchased seats across all tenants |

### 3. Product Health Monitoring

```
┌─────────────────────────────────────────────────────────────────┐
│ System Health                                                    │
│                                                                  │
│ OpShield API     ● Online    Latency: 12ms    Uptime: 99.98%    │
│ OpShield Web     ● Online    Latency: 45ms    Uptime: 99.99%    │
│ SafeSpec API     ● Online    Latency: 18ms    Uptime: 99.95%    │
│ SafeSpec Web     ● Online    Latency: 52ms    Uptime: 99.97%    │
│ Nexum API        ● Online    Latency: 15ms    Uptime: 99.96%    │
│ Nexum Web        ● Online    Latency: 48ms    Uptime: 99.98%    │
│ PostgreSQL       ● Online    Connections: 42/100                 │
│ Redis            ● Online    Memory: 128MB/512MB                 │
│ MinIO            ● Online    Storage: 12GB/100GB                 │
│ Stripe API       ● Online    (external)                          │
│                                                                  │
│ Recent Alerts                                                    │
│ ─ 2026-03-19 03:12  SafeSpec API latency spike (450ms, 2min)   │
│ ─ 2026-03-15 14:30  Stripe webhook delivery delayed (5min)     │
└─────────────────────────────────────────────────────────────────┘
```

Products expose a health endpoint that OpShield polls:

```
GET /api/health (on each product)

Response:
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime_seconds": 864000,
  "database": "connected",
  "redis": "connected",
  "active_tenants": 145,
  "total_users": 2340
}
```

### 4. Support Tools

#### Tenant Impersonation

Platform admins can "log in as" any tenant to troubleshoot issues:

```
1. Admin clicks [Impersonate] on tenant detail page
2. OpShield creates a temporary impersonation session
3. Admin is redirected to the product as if they were the tenant owner
4. Yellow banner shown: "⚠️ Impersonating: Smith Haulage (admin: ryan@redbay.com.au)"
5. All actions are audit-logged with impersonation context
6. Session auto-expires after 30 minutes
7. Admin clicks "End Impersonation" to return to admin dashboard
```

**Audit trail for impersonation:**
```
{
  "action": "impersonate_start",
  "admin_user_id": "ryan-uuid",
  "tenant_id": "smith-haulage-uuid",
  "product": "nexum",
  "reason": "Support ticket #1234",
  "started_at": "2026-03-20T10:00:00Z",
  "ended_at": "2026-03-20T10:15:00Z"
}
```

#### Data Export

Export tenant data for support or compliance purposes:

| Export Type | Format | Contains |
|------------|--------|----------|
| Tenant summary | JSON/CSV | Company details, subscription, user counts |
| Billing history | CSV | All invoices, payments, credits |
| Audit log | JSON | All platform-level actions for this tenant |
| Full data export | ZIP | Everything above + request to product for tenant data |

Product data exports (actual SafeSpec/Nexum data) are requested via API — OpShield doesn't have direct access to tenant schema data.

### 5. Feature Flags

Control feature availability per tenant or globally:

```
feature_flags
├── id (UUID)
├── key (text — e.g., "ai_automation_v2", "beta_map_planning")
├── description (text)
├── scope (enum: global, product, tenant)
├── product_id (text, nullable — for product-scoped flags)
├── tenant_ids (UUID[], nullable — for tenant-scoped flags)
├── enabled (boolean)
├── created_at
└── updated_at
```

Feature flags are included in the entitlements response so products can check them alongside module access.

### 6. Provisioning Management

#### Manual Provisioning

For cases where automatic provisioning fails or a special setup is needed:

```
┌─────────────────────────────────────────────────────────────────┐
│ Provisioning Queue                                               │
│                                                                  │
│ Tenant              │ Product  │ Status        │ Actions         │
│ ────────────────────┼──────────┼───────────────┼──────────────── │
│ New Corp Pty Ltd    │ Nexum    │ Provisioning  │ [View Log]      │
│ Alpha Transport     │ SafeSpec │ Failed ⚠️     │ [Retry] [Log]   │
│ Beta Construction   │ Both     │ Partial ⚠️    │ [Retry] [Log]   │
│                                                                  │
│ [+ Manual Provision]                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Platform Admin API Endpoints

All routes require `requirePlatformAdmin()` middleware.

### Tenant Management
```
GET    /api/admin/tenants                    — List all tenants (paginated, filterable)
GET    /api/admin/tenants/:id                — Tenant detail with full subscription info
POST   /api/admin/tenants                    — Create tenant manually
PATCH  /api/admin/tenants/:id                — Update tenant details
POST   /api/admin/tenants/:id/suspend        — Suspend tenant
POST   /api/admin/tenants/:id/reactivate     — Reactivate tenant
POST   /api/admin/tenants/:id/delete         — Start 90-day deletion countdown
```

### Subscription Management
```
POST   /api/admin/tenants/:id/products       — Add product to tenant
DELETE /api/admin/tenants/:id/products/:pid   — Remove product from tenant
POST   /api/admin/tenants/:id/modules        — Add module
DELETE /api/admin/tenants/:id/modules/:mid    — Remove module
PATCH  /api/admin/tenants/:id/plan           — Change plan/tier
POST   /api/admin/tenants/:id/discount       — Apply discount
POST   /api/admin/tenants/:id/credit         — Apply billing credit
POST   /api/admin/tenants/:id/override-limit — Override user limit
```

### Analytics
```
GET    /api/admin/analytics/revenue          — MRR, growth, churn
GET    /api/admin/analytics/tenants          — Tenant counts, trial conversion
GET    /api/admin/analytics/usage            — User counts, storage, API calls
GET    /api/admin/analytics/modules          — Module adoption rates
```

### System
```
GET    /api/admin/health                     — All product health status
GET    /api/admin/provisioning               — Provisioning queue
POST   /api/admin/provisioning/:id/retry     — Retry failed provisioning
GET    /api/admin/feature-flags              — List all flags
POST   /api/admin/feature-flags              — Create flag
PATCH  /api/admin/feature-flags/:id          — Update flag
GET    /api/admin/audit-log                  — Platform audit log (paginated)
```

### Support
```
POST   /api/admin/impersonate               — Start impersonation session
DELETE /api/admin/impersonate                — End impersonation session
POST   /api/admin/tenants/:id/export         — Request data export
```

---

## Cross-Product Admin Actions

Some admin actions require coordination across products:

| Action | OpShield Does | Products Do |
|--------|--------------|-------------|
| Suspend tenant | Updates status, pauses Stripe | Disable write access, show banner |
| Cancel subscription | Schedules cancellation in Stripe | Disable access at period end |
| Add product | Creates tenant_products record, provisions schema | Enable product access |
| Add module | Creates tenant_modules record, updates Stripe | Enable module features |
| Impersonate | Creates temp session, redirects to product | Show impersonation banner, audit log |
| Force deprovision | Drops schema records, archives Stripe customer | Drop tenant schema (after backup) |

All cross-product actions use the same webhook system described in `docs/03-INTEGRATION-ARCHITECTURE.md`.

---

## Security

- Platform admin routes are **never accessible to tenant users**
- All admin actions are **immutably audit-logged** with admin user ID, action, target, timestamp
- Impersonation sessions are **time-limited** (30 min) and **logged separately**
- Destructive actions (delete, deprovision) require **confirmation + reason text**
- Super admin access cannot be self-granted — must be added by another super admin or via database migration
- Platform admin endpoints are on a separate route prefix (`/api/admin/`) with dedicated middleware
