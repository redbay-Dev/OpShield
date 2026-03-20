# 01 — Product & Module Architecture

> How OpShield manages products, modules, and subscriptions across the Redbay suite.

## The Problem

SafeSpec and Nexum are not monolithic products — they are **modular**. A customer signing up to SafeSpec does not automatically get everything SafeSpec offers. They choose which modules they need. The same applies to Nexum. OpShield must track what each tenant has purchased and communicate this to each product so they can enforce access.

---

## Product & Module Hierarchy

```
OpShield (Platform Layer)
│
├── SafeSpec (Compliance Product)
│   ├── WHS Module            ← Purchasable separately
│   │   ├── Hazard Register
│   │   ├── Incident Reporting
│   │   ├── SWMS Builder
│   │   ├── JSA Builder
│   │   ├── Inspections & Audits
│   │   ├── Corrective Actions
│   │   ├── Document Management
│   │   ├── Legislative Register
│   │   ├── Workers' Compensation
│   │   ├── RTW Plans
│   │   └── WHS PDF Forms
│   │
│   └── HVA Compliance Module ← Purchasable separately
│       ├── Safety Management System (SMS) Builder
│       ├── Fatigue Management (BFM/AFM)
│       ├── Mass Management
│       ├── Fitness to Drive
│       ├── Audit Management
│       ├── Vehicle Registers
│       ├── Chain of Responsibility
│       ├── HVA PDF & Export
│       └── Fleet Maintenance (premium add-on within HVA)
│           ├── Preventive Maintenance Scheduling
│           ├── Defect Management
│           ├── Work Orders & Cost Tracking
│           └── Compliance Linkage
│
└── Nexum (Operations Product)
    ├── Core (always included)
    │   ├── Jobs
    │   ├── Business Entities
    │   ├── Scheduling
    │   └── Dashboard
    │
    └── Optional Modules        ← Each purchasable separately
        ├── Invoicing
        ├── RCTI (Recipient Created Tax Invoices)
        ├── Xero Integration
        ├── Compliance (SafeSpec integration)
        ├── SMS Messaging
        ├── Docket Processing
        ├── Materials Management
        ├── Map Planning
        ├── AI Automation
        ├── Reporting & Analytics
        └── Portal (contractor/customer access)
```

---

## SafeSpec Module Details

### WHS Module (Work Health & Safety)

**What it covers:** Australian WHS Act compliance for workplaces with 10-500 employees. Hazard identification, incident reporting, SWMS/JSA creation, inspections, audits, corrective actions, and document management.

**Target market:** Any business with a duty of care under WHS legislation — construction, civil, industrial, manufacturing, mining support services.

**Key features:**
- Hazard Identification & Risk Register (likelihood/consequence matrix)
- Incident Reporting (types, severity, notifiable determination, investigation workflow)
- SWMS Builder (task types, hazard steps, risk matrix, PPE/equipment, sign-off, revisions)
- JSA Builder
- Configurable Pre-Start Checklists
- Workplace Inspections (recurring, role-based assignment)
- Internal Audit Module (questionnaire builder, scoring, gap analysis)
- PCBU Compliance Checklist (jurisdiction-aware with legislative register)
- Corrective Action Register
- Document Management with e-signatures
- Workers' Compensation tracking
- Return-to-Work Plans
- Pre-filled PDF Generation (Puppeteer + Handlebars)

**Pricing (base + per-user):**
| Tier | Base Price | Included Users | Extra Users |
|------|-----------|---------------|-------------|
| Starter | $49/month | 5 | $5/user/month |
| Growth | $99/month | 15 | $4/user/month |
| Business | $199/month | 50 | $3/user/month |
| Enterprise | Custom | Custom | Custom |
| Annual | All tiers | — | 2 months free (~16% discount) |

> Full pricing details: See `docs/04-BILLING-PRICING-MODEL.md`

### HVA Compliance Module (Heavy Vehicle Accreditation)

**What it covers:** NHVAS → HVA transition compliance. Manages safety management systems, fatigue management, mass management, fitness to drive, vehicle registers, chain of responsibility, and audit preparation for heavy vehicle operators.

**Target market:** Transport and haulage operators who need NHVAS/HVA accreditation — trucking companies, heavy haulage, fleet operators.

**Key features:**
- SMS Builder & Gap Analysis Tool (Safety Management System, not text messaging)
- Fatigue Management (BFM — Basic Fatigue Management, AFM — Advanced Fatigue Management)
- Mass Management (load tracking, CML compliance)
- Fitness to Drive (medical, vision, licensing)
- Audit Management (preparation, evidence collection, findings)
- Vehicle Registers (registration, CTP, maintenance records)
- Chain of Responsibility (CoR duties tracking)
- PDF & Export (compliance audit packages)
- Fleet Maintenance (premium add-on — preventive scheduling, defect management, work orders)

**Pricing (base + per-user):**
| Tier | Base Price | Included Users | Extra Users |
|------|-----------|---------------|-------------|
| Solo Operator | $39/month | 3 | $8/user/month |
| Small Fleet | $89/month | 10 | $6/user/month |
| Medium Fleet | $189/month | 25 | $5/user/month |
| Large/Enterprise | Custom | Custom | Custom |
| NHVAS Transition Pack | $199 one-off | — | — |
| Annual | All tiers | — | 2 months free |

> Full pricing details: See `docs/04-BILLING-PRICING-MODEL.md`

### SafeSpec Purchase Combinations

| Configuration | What They Get |
|--------------|---------------|
| WHS only | All WHS features. No HVA/fatigue/mass/vehicle/CoR features. |
| HVA only | All HVA features. No hazard register, incidents, SWMS, JSA, inspections. |
| WHS + HVA | Full SafeSpec suite. Shared worker/vehicle records, cross-module reporting. |
| WHS + HVA + Fleet Maintenance | Everything above + preventive maintenance, work orders, defect management. |

**Critical enforcement rule:** If a tenant has WHS only, they must NOT see or access any HVA screens, APIs, or data. The sidebar navigation, route guards, and API middleware must all respect the module subscription. Same in reverse — HVA-only tenants cannot access WHS features.

---

## Nexum Module Details

### Core (Always Included)

Every Nexum tenant gets:
- **Jobs** — Job lifecycle management (create, schedule, dispatch, complete, invoice)
- **Business Entities** — Customers, contractors, suppliers (unified company model)
- **Scheduling** — Resource allocation, calendar, availability
- **Dashboard** — KPIs, upcoming jobs, alerts

### Optional Modules

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Invoicing** | Invoice generation and AR | Create invoices from jobs, credit notes, AR tracking, payment recording |
| **RCTI** | Recipient Created Tax Invoices | Contractor payment management, remittance, ATO-compliant RCTIs |
| **Xero** | Accounting integration | Bidirectional sync with Xero (invoices, contacts, payments) |
| **Compliance** | SafeSpec integration | Compliance status badges, pre-start integration, licence/medical alerts |
| **SMS** | Text messaging | Multi-provider SMS, templates, conversations, delivery tracking |
| **Docket Processing** | Digital docket capture | Photo capture, approval workflows, docket-to-invoice pipeline |
| **Materials** | Material & disposal management | Material types, pricing rules, supplier relationships, disposal tracking |
| **Map Planning** | Route & location intelligence | Route planning, backhaul detection, geofencing, travel time estimation |
| **AI Automation** | AI-powered workflows | Job parsing from emails/messages, review automation, smart suggestions |
| **Reporting** | Advanced analytics | Financial reports, compliance reports, performance dashboards |
| **Portal** | External user access | Web portal for contractors and customers to view jobs/invoices |

**Critical enforcement rule:** The Nexum `Compliance` module requires the tenant to ALSO have an active SafeSpec subscription. OpShield must verify both subscriptions exist before enabling the compliance module in Nexum.

---

## How OpShield Tracks Modules

### Database Schema

OpShield's `tenant_products` table tracks which products a tenant has. Module subscriptions are tracked in a new `tenant_modules` table:

```
tenant_modules
├── id (UUID)
├── tenant_id → tenants.id
├── tenant_product_id → tenant_products.id
├── module_id (text — e.g., "whs", "hva", "fleet_maintenance", "invoicing", "rcti")
├── status (enum: active, suspended, cancelled)
├── plan (text, nullable — module-specific tier if applicable)
├── stripe_subscription_item_id (text, nullable)
├── activated_at (timestamp)
├── suspended_at (timestamp, nullable)
├── cancelled_at (timestamp, nullable)
├── config (JSONB — module-specific settings)
├── created_at
└── updated_at
```

### Module Registry

OpShield maintains a `product_modules` table defining all available modules:

```
product_modules
├── id (text — e.g., "whs", "hva", "fleet_maintenance")
├── product_id → products.id (e.g., "safespec", "nexum")
├── name (text — display name)
├── description (text)
├── is_core (boolean — true = included with product, false = optional/add-on)
├── is_add_on (boolean — true = add-on to another module, not standalone)
├── parent_module_id (text, nullable — e.g., fleet_maintenance → hva)
├── requires_module_ids (text[], nullable — cross-product dependencies)
├── requires_product_ids (text[], nullable — cross-product dependencies)
├── pricing_config (JSONB — tier definitions, per-unit pricing)
├── sort_order (integer)
├── active (boolean)
├── created_at
└── updated_at
```

### Module Dependency Examples

```
Module: "fleet_maintenance"
  product: "safespec"
  is_add_on: true
  parent_module_id: "hva"
  → Cannot be purchased without HVA module

Module: "compliance" (in Nexum)
  product: "nexum"
  is_core: false
  requires_product_ids: ["safespec"]
  → Cannot be enabled unless tenant also has SafeSpec subscription
```

---

## Module Enforcement Architecture

### Three Layers of Enforcement

Module access is enforced at **three layers** — never trust a single layer:

```
┌─────────────────────────────────────────┐
│ Layer 1: OpShield (source of truth)     │
│ ─ Tracks subscriptions and modules      │
│ ─ Communicates entitlements to products  │
│ ─ Stripe webhooks update status          │
└──────────────────┬──────────────────────┘
                   │ API: GET /api/tenants/:id/entitlements
                   │ Webhook: module.activated, module.suspended
                   ▼
┌─────────────────────────────────────────┐
│ Layer 2: Product Backend (enforcer)     │
│ ─ Caches entitlements from OpShield     │
│ ─ API middleware checks module access   │
│ ─ Returns 403 if module not subscribed  │
│ ─ Refreshes cache on webhook events     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Layer 3: Product Frontend (UI guard)    │
│ ─ Hides navigation items for disabled   │
│   modules                               │
│ ─ Route guards redirect to upgrade page │
│ ─ Feature flags disable UI elements     │
│ ─ NEVER relied on alone (cosmetic only) │
└─────────────────────────────────────────┘
```

### OpShield Entitlements API

Products call OpShield to get a tenant's active modules and licence limits:

```
GET /api/tenants/:tenantId/entitlements

Response:
{
  "tenant_id": "uuid",
  "products": {
    "safespec": {
      "status": "active",
      "plan": "growth",
      "included_users": 15,
      "max_users": null,
      "modules": {
        "whs": { "status": "active", "plan": "growth", "included_users": 15 },
        "hva": { "status": "active", "plan": "small_fleet", "included_users": 10 },
        "fleet_maintenance": { "status": "suspended", "reason": "payment_failed" }
      }
    },
    "nexum": {
      "status": "active",
      "plan": "professional",
      "included_users": 15,
      "max_users": null,
      "modules": {
        "invoicing": { "status": "active" },
        "rcti": { "status": "active" },
        "xero": { "status": "active" },
        "compliance": { "status": "active" },
        "sms": { "status": "cancelled" }
      }
    }
  }
}

Notes:
- `included_users` = seats in the base price. Overages billed per-user.
- `max_users` = hard cap set by tenant owner (null = no cap, overages auto-billed).
- Nexum optional modules share Core's user allocation — no separate user count.
- SafeSpec WHS and HVA have independent user counts and tiers.
- Products enforce: block user invites when at cap, report counts to OpShield.
```

### Product-Side Middleware (Example: SafeSpec)

Each product implements middleware that checks module entitlements:

```typescript
// SafeSpec backend middleware (conceptual)
const requireModule = (moduleId: 'whs' | 'hva' | 'fleet_maintenance') => {
  return async (request, reply) => {
    const entitlements = await getEntitlements(request.tenantId);
    const module = entitlements.modules[moduleId];

    if (!module || module.status !== 'active') {
      return reply.status(403).send({
        error: 'MODULE_NOT_SUBSCRIBED',
        module: moduleId,
        message: `This feature requires an active ${moduleId.toUpperCase()} subscription.`,
        upgrade_url: `${OPSHIELD_URL}/billing/upgrade?module=${moduleId}`
      });
    }
  };
};

// Usage in routes:
app.get('/api/hazards', { preHandler: [requireAuth, requireModule('whs')] }, getHazards);
app.get('/api/fatigue-logs', { preHandler: [requireAuth, requireModule('hva')] }, getFatigueLogs);
app.get('/api/maintenance-schedules', { preHandler: [requireAuth, requireModule('fleet_maintenance')] }, getMaintenanceSchedules);
```

### Frontend Route Guards (Example: SafeSpec)

```typescript
// SafeSpec frontend (conceptual)
const ProtectedRoute = ({ moduleId, children }) => {
  const { modules } = useEntitlements();

  if (!modules[moduleId] || modules[moduleId].status !== 'active') {
    return <UpgradePrompt module={moduleId} />;
  }

  return children;
};

// WHS routes — only visible if WHS module is active
<Route path="/hazards" element={<ProtectedRoute moduleId="whs"><HazardsPage /></ProtectedRoute>} />
<Route path="/incidents" element={<ProtectedRoute moduleId="whs"><IncidentsPage /></ProtectedRoute>} />
<Route path="/swms" element={<ProtectedRoute moduleId="whs"><SwmsPage /></ProtectedRoute>} />

// HVA routes — only visible if HVA module is active
<Route path="/fatigue" element={<ProtectedRoute moduleId="hva"><FatiguePage /></ProtectedRoute>} />
<Route path="/mass-management" element={<ProtectedRoute moduleId="hva"><MassPage /></ProtectedRoute>} />
<Route path="/vehicle-registers" element={<ProtectedRoute moduleId="hva"><VehicleRegistersPage /></ProtectedRoute>} />
```

---

## Cross-Product Module Dependencies

### Nexum "Compliance" Module ↔ SafeSpec

The Nexum `compliance` module provides compliance status badges, pre-start integration, and licence/medical alerts by pulling data from SafeSpec. This creates a **cross-product dependency**:

```
Nexum Compliance Module
  requires_product_ids: ["safespec"]
  requires at least ONE SafeSpec module (WHS or HVA) to be active
```

**Enforcement:**
1. When a tenant tries to enable `compliance` in Nexum, OpShield checks for an active SafeSpec subscription
2. If SafeSpec subscription is cancelled, OpShield notifies Nexum to disable the compliance module
3. Nexum's compliance features degrade gracefully — show "SafeSpec subscription required" instead of crashing

### What Nexum Gets From Each SafeSpec Module

| SafeSpec Module | What Nexum Compliance Shows |
|----------------|---------------------------|
| WHS active | Hazard alerts, incident notifications, SWMS status, inspection compliance |
| HVA active | Driver licence/medical status, fatigue compliance, vehicle registration, CoR status |
| Both active | Full compliance dashboard with all of the above |
| Neither | Compliance module disabled in Nexum |

---

## Sign-Up Flow With Module Selection

```
1. User visits OpShield public website
2. Selects product(s): SafeSpec, Nexum, or Both
3. If SafeSpec selected:
   a. Choose modules: WHS, HVA, or Both
   b. If HVA selected, optionally add Fleet Maintenance
   c. Select plan tier (per module)
4. If Nexum selected:
   a. Core is automatic
   b. Choose optional modules (checkboxes)
   c. Select plan tier
5. Enter company details (name, ABN, contact)
6. Create account (email, password)
7. Enter payment (Stripe Checkout / Elements)
8. OpShield provisions:
   a. Creates tenant record
   b. Creates tenant_products records
   c. Creates tenant_modules records
   d. Provisions database schema(s) in product database(s)
   e. Seeds default data appropriate to selected modules
9. Redirect to product with active session
```

---

## Module Lifecycle Events

OpShield emits webhooks to products when module status changes:

| Event | Trigger | Product Action |
|-------|---------|---------------|
| `module.activated` | New subscription or reactivation | Enable module features, run module-specific seed data |
| `module.suspended` | Payment failed, manual suspension | Disable write access, show warning banners, keep data |
| `module.cancelled` | Tenant cancels module | Disable all access, data retained for 90 days |
| `module.plan_changed` | Upgrade/downgrade | Update limits (users, vehicles, storage) |
| `module.trial_started` | Trial activated | Enable features with trial badge |
| `module.trial_ended` | Trial period expired | Disable if not converted to paid |

---

## Data Isolation Between Modules

Within SafeSpec, WHS and HVA modules share some data and isolate other data:

### Shared Data (accessible regardless of module)
- Worker/employee records (name, contact, employment details)
- Vehicle records (rego, make, model)
- Company profile
- Audit log

### WHS-Only Data
- Hazard register entries
- Incident reports
- SWMS documents
- JSA documents
- Workplace inspections
- Corrective actions
- Workers' compensation records
- RTW plans

### HVA-Only Data
- SMS (Safety Management System) documents
- Fatigue management logs
- Mass management records
- Fitness to drive records
- HVA audit management
- Chain of responsibility records

### Both (when tenant has both modules)
- Cross-module reporting (unified compliance dashboard)
- Shared vehicle defect tracking
- Combined audit packages
- Integrated PDF generation

---

## Stripe Billing Structure

Each tenant has **one Stripe Subscription** with **multiple subscription items** — one per active module base price, plus per-user overage items where applicable. Nexum optional modules are flat add-ons (no separate user count — they use Core's user allocation).

> Full Stripe implementation details: See `docs/04-BILLING-PRICING-MODEL.md`
