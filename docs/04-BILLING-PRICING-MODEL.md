# 04 — Billing & Pricing Model

> How OpShield handles Stripe billing, per-module pricing, user-based licensing, and usage reporting.

## Pricing Philosophy

Every module has a **base price** that includes a set number of users. Additional users are charged per-user beyond the included allocation. This keeps entry costs low for small operators while scaling revenue with larger teams.

The tenant manages their subscription (products, modules, plans) through OpShield. But the actual user accounts — who can log in, what role they have, what permissions they hold — are managed inside each product. OpShield only sees **user counts** for billing purposes.

---

## Ownership Boundary: Who Controls What

```
┌──────────────────────────────────────────────────────────┐
│ OpShield Controls (Subscription & Billing)               │
│                                                          │
│  ✓ Which products the tenant has                         │
│  ✓ Which modules are active per product                  │
│  ✓ What plan/tier each module is on                      │
│  ✓ Stripe subscription management                        │
│  ✓ Invoice history and payment status                    │
│  ✓ User licence totals (how many seats purchased)        │
│  ✓ User licence usage (how many seats used — read only)  │
│  ✓ Billing contact and payment methods                   │
│  ✓ Upgrade/downgrade/cancel flows                        │
│  ✓ Trial management                                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Each Product Controls (User Management)                  │
│                                                          │
│  ✓ Creating/inviting users within the tenant             │
│  ✓ Assigning roles (owner, admin, dispatcher, etc.)      │
│  ✓ Setting permissions per role                          │
│  ✓ Deactivating/removing users                           │
│  ✓ User profile within the product context               │
│  ✓ Enforcing the user limit (reject invite if at cap)    │
│                                                          │
│  The product calls OpShield to check:                    │
│  "How many user seats does this tenant have for me?"     │
│  Then enforces it locally.                               │
└──────────────────────────────────────────────────────────┘
```

### Why OpShield Doesn't Manage Product Users

OpShield doesn't know what a "dispatcher" or "compliance officer" is. Each product has its own role model:

| Product | Roles |
|---------|-------|
| **Nexum** | owner, admin, dispatcher, finance, compliance, read_only |
| **SafeSpec** | owner, admin, safety_officer, supervisor, worker, read_only |

OpShield only knows: "This tenant has 12 user seats for Nexum and 8 for SafeSpec." The products decide who those users are and what they can do.

---

## Pricing Structure

### Base + Per-User Model

Every module follows this pattern:

```
Monthly cost = Module base price + (additional users × per-user rate)

Where:
  additional users = max(0, active_users - included_users)
```

### SafeSpec Pricing

#### WHS Module

| Tier | Included Users | Base Price | Additional Users |
|------|---------------|------------|------------------|
| Starter | 5 | $49/month | $5/user/month |
| Growth | 15 | $99/month | $4/user/month |
| Business | 50 | $199/month | $3/user/month |
| Enterprise | Custom | Custom | Custom |

**Examples:**
- Starter with 5 users = $49/month
- Starter with 8 users = $49 + (3 × $5) = $64/month
- Growth with 25 users = $99 + (10 × $4) = $139/month

#### HVA Compliance Module

| Tier | Included Users | Base Price | Additional Users |
|------|---------------|------------|------------------|
| Solo Operator | 3 | $39/month | $8/user/month |
| Small Fleet | 10 | $89/month | $6/user/month |
| Medium Fleet | 25 | $189/month | $5/user/month |
| Large/Enterprise | Custom | Custom | Custom |

#### Fleet Maintenance (HVA Add-On)

| Tier | Included Users | Base Price | Additional Users |
|------|---------------|------------|------------------|
| Standard | Inherits from HVA | $29/month | — (uses HVA user count) |

Fleet Maintenance doesn't have its own user count — it inherits the HVA module's user allocation. The $29/month is a flat add-on.

### Nexum Pricing

#### Core (Always Included)

| Tier | Included Users | Base Price | Additional Users |
|------|---------------|------------|------------------|
| Starter | 5 | $79/month | $8/user/month |
| Professional | 15 | $179/month | $6/user/month |
| Enterprise | Custom | Custom | Custom |

#### Optional Module Add-Ons

Each optional Nexum module adds to the base subscription. These do NOT have their own user counts — they use the core user allocation.

| Module | Monthly Add-On |
|--------|---------------|
| Invoicing | $29/month |
| RCTI | $19/month |
| Xero Integration | $19/month |
| Compliance (requires SafeSpec) | $29/month |
| SMS Messaging | $19/month + usage |
| Docket Processing | $19/month |
| Materials Management | $19/month |
| Map Planning | $19/month |
| AI Automation | $29/month + usage |
| Reporting & Analytics | $19/month |
| Portal | $29/month |

**Example: Nexum Professional + Invoicing + RCTI + Xero with 20 users:**
- Core: $179 + (5 extra users × $6) = $209
- Invoicing: $29
- RCTI: $19
- Xero: $19
- **Total: $276/month**

### Bundle Discount

When a tenant subscribes to both SafeSpec and Nexum, they receive a percentage discount:

| Bundle | Discount |
|--------|----------|
| Any SafeSpec module + Any Nexum plan | 10% off total |
| Both SafeSpec modules + Nexum Professional+ | 15% off total |

### Annual Billing

All plans: **2 months free** when paying annually (~16% discount). Applied on top of any bundle discount.

---

## User Licence Tracking

### How OpShield Knows User Counts

Products report their active user counts to OpShield. This happens via:

1. **Periodic sync** — Each product reports user counts every hour via API
2. **Event-driven** — Product notifies OpShield when a user is added/removed
3. **On-demand** — OpShield queries product for current count when displaying billing

```
Product → OpShield: POST /api/internal/usage/users
{
  "product_id": "nexum",
  "tenant_id": "uuid",
  "active_user_count": 18,
  "user_breakdown": {
    "owner": 1,
    "admin": 2,
    "dispatcher": 8,
    "finance": 3,
    "compliance": 2,
    "read_only": 2
  },
  "reported_at": "2026-03-20T10:00:00Z"
}
```

### OpShield Billing Dashboard (Tenant View)

When a tenant views their subscription in OpShield, they see:

```
┌─────────────────────────────────────────────────────┐
│ Your Subscription                                    │
│                                                      │
│ SafeSpec — WHS Module (Growth)                       │
│   Base: $99/month (includes 15 users)                │
│   Active users: 22 of 15 included                    │
│   Additional users: 7 × $4 = $28/month               │
│   Subtotal: $127/month                               │
│                                                      │
│ SafeSpec — HVA Compliance (Small Fleet)              │
│   Base: $89/month (includes 10 users)                │
│   Active users: 8 of 10 included                     │
│   Additional users: 0                                │
│   Subtotal: $89/month                                │
│                                                      │
│ SafeSpec — Fleet Maintenance (Add-On)                │
│   Flat rate: $29/month                               │
│   Subtotal: $29/month                                │
│                                                      │
│ Nexum — Core (Professional)                          │
│   Base: $179/month (includes 15 users)               │
│   Active users: 20 of 15 included                    │
│   Additional users: 5 × $6 = $30/month               │
│   Subtotal: $209/month                               │
│                                                      │
│ Nexum — Invoicing Module                             │
│   Flat rate: $29/month                               │
│                                                      │
│ Nexum — RCTI Module                                  │
│   Flat rate: $19/month                               │
│                                                      │
│ ─────────────────────────────────────────────────    │
│ Subtotal: $502/month                                 │
│ Bundle discount (15%): -$75.30                       │
│ Total: $426.70/month (excl. GST)                     │
│ GST (10%): $42.67                                    │
│ Total incl. GST: $469.37/month                       │
│                                                      │
│ [Manage Users → Nexum]  [Manage Users → SafeSpec]    │
│ [Change Plan]  [Add Module]  [View Invoices]         │
└─────────────────────────────────────────────────────┘
```

Note the "Manage Users" buttons link **out to the product** — OpShield doesn't manage users, it just displays the counts.

### Product-Side User Limit Enforcement

When a user tries to invite someone in Nexum or SafeSpec:

```
1. Product checks: "How many active users do I have for this tenant?" → 15
2. Product calls OpShield: GET /api/tenants/:id/entitlements
   → Returns: included_users: 15, max_users: 15 (or unlimited)
3. If active_users >= max_users:
   → Block invite with message:
     "You've reached your user limit (15/15).
      Upgrade your plan or purchase additional seats."
   → Link to OpShield billing page
4. If active_users < max_users:
   → Allow invite
   → Notify OpShield of new user count
```

### Automatic Overage Billing

When a product reports user count exceeding the included allocation:

1. Stripe metered billing charges for overages at end of billing period
2. OR OpShield updates the subscription quantity in real-time (preferred — predictable for the customer)
3. Customer sees the additional cost on their next invoice
4. No hard cap by default — warn the tenant but allow the extra user
5. Tenant owner can set a hard cap in OpShield: "Don't allow more than X users" → products enforce this

---

## Stripe Implementation

### Subscription Structure

Each tenant has **one Stripe Subscription** with **multiple subscription items**:

```
Stripe Subscription (tenant)
├── Item: safespec_whs_growth          (base price: $99/month)
├── Item: safespec_whs_extra_users     (metered: $4/user/month, quantity: 7)
├── Item: safespec_hva_small_fleet     (base price: $89/month)
├── Item: safespec_fleet_maintenance   (flat: $29/month)
├── Item: nexum_core_professional      (base price: $179/month)
├── Item: nexum_extra_users            (metered: $6/user/month, quantity: 5)
├── Item: nexum_invoicing              (flat: $29/month)
├── Item: nexum_rcti                   (flat: $19/month)
└── Coupon: bundle_15_percent          (discount: -15%)
```

### Stripe Products & Prices

OpShield creates these in Stripe:

```
Stripe Product: "SafeSpec WHS"
  Prices:
    safespec_whs_starter:       $49/month (recurring, fixed)
    safespec_whs_growth:        $99/month
    safespec_whs_business:      $199/month
    safespec_whs_extra_user:    $5/month (per unit — starter)
    safespec_whs_extra_user_g:  $4/month (per unit — growth)
    safespec_whs_extra_user_b:  $3/month (per unit — business)

Stripe Product: "SafeSpec HVA"
  Prices:
    safespec_hva_solo:          $39/month
    safespec_hva_small:         $89/month
    safespec_hva_medium:        $189/month
    safespec_hva_extra_user:    $8/month (per unit — solo)
    safespec_hva_extra_user_s:  $6/month (per unit — small)
    safespec_hva_extra_user_m:  $5/month (per unit — medium)

Stripe Product: "SafeSpec Fleet Maintenance"
  Prices:
    safespec_fleet_standard:    $29/month (flat)

Stripe Product: "Nexum Core"
  Prices:
    nexum_core_starter:         $79/month
    nexum_core_professional:    $179/month
    nexum_extra_user_s:         $8/month (per unit — starter)
    nexum_extra_user_p:         $6/month (per unit — professional)

Stripe Products: "Nexum [Module]" (one per optional module)
  Prices:
    nexum_invoicing:            $29/month (flat)
    nexum_rcti:                 $19/month (flat)
    ... etc.

Stripe Coupons:
    bundle_10_percent:          10% off (forever, while both products active)
    bundle_15_percent:          15% off
    annual_2_months_free:       ~16.67% off (applied to annual billing)
```

### Key Stripe Webhooks

| Webhook Event | OpShield Action |
|--------------|-----------------|
| `invoice.payment_succeeded` | Update tenant status to active, log payment |
| `invoice.payment_failed` | Set status to past_due, send warning email, notify products |
| `customer.subscription.updated` | Sync plan/module changes to OpShield records |
| `customer.subscription.deleted` | Set status to cancelled, notify products to disable access |
| `customer.subscription.trial_will_end` | Send trial ending reminder (3 days before) |
| `checkout.session.completed` | Complete initial sign-up provisioning |

---

## OpShield Database Tables for Billing

### `tenant_usage` — Tracks user counts over time

```
tenant_usage
├── id (UUID)
├── tenant_id → tenants.id
├── tenant_product_id → tenant_products.id
├── metric (text — "active_users", "storage_mb", "api_calls")
├── value (integer)
├── breakdown (JSONB — e.g., { owner: 1, admin: 2, dispatcher: 8 })
├── reported_by (text — "nexum", "safespec")
├── reported_at (timestamp)
├── created_at
└── (no updated_at — append-only for history)
```

### `billing_events` — Immutable log of billing actions

```
billing_events
├── id (UUID)
├── tenant_id → tenants.id
├── event_type (text — "payment_succeeded", "plan_changed", "module_added", etc.)
├── stripe_event_id (text — Stripe event ID for deduplication)
├── amount_cents (integer, nullable)
├── currency (text — "aud")
├── metadata (JSONB — full event details)
├── created_at
└── (immutable — no updates or deletes)
```

---

## Plan Change Rules

### Upgrades (immediate)
- Prorated charge for remainder of billing period
- New limits effective immediately
- Product notified via webhook

### Downgrades (end of period)
- Scheduled for end of current billing period
- Current limits remain until period ends
- If current user count exceeds new plan's limit: tenant must remove users before downgrade takes effect
- OpShield warns: "You have 22 users but the Starter plan includes 5. Please remove 17 users or purchase additional seats."

### Module Addition (immediate)
- Prorated charge
- Module activated immediately
- Product enables features via webhook

### Module Cancellation (end of period)
- Access continues until end of billing period
- Data retained for 90 days after cancellation
- Tenant can reactivate within 90 days without data loss

---

## GST Handling

All prices are **exclusive of GST**. Stripe handles Australian GST (10%) automatically via Stripe Tax. Invoices show:
- Subtotal (excl. GST)
- GST amount
- Total (incl. GST)

ABN is collected at sign-up for tax invoice compliance.
