# 03 — Integration Architecture

> How OpShield, SafeSpec, and Nexum communicate and enforce module boundaries.

## System Topology

```
                    ┌───────────────┐
                    │   Stripe      │
                    │  (Billing)    │
                    └───────┬───────┘
                            │ Webhooks
                            ▼
┌───────────────────────────────────────────────────────┐
│                      OpShield                          │
│                                                        │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth     │  │ Tenant       │  │ Module         │  │
│  │ (Better  │  │ Registry     │  │ Entitlements   │  │
│  │  Auth)   │  │              │  │                │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬────────┘  │
│       │               │                  │            │
│       │  ┌────────────┼──────────────────┤            │
│       │  │            │                  │            │
└───────┼──┼────────────┼──────────────────┼────────────┘
        │  │            │                  │
   Token│  │Provision   │ Entitlements     │ Webhooks
   Valid.│  │Schema      │ API              │ (module events)
        │  │            │                  │
   ┌────▼──▼────┐  ┌───▼──────────────────▼────┐
   │  SafeSpec  │  │         Nexum              │
   │            │  │                            │
   │ ┌────────┐ │  │ ┌──────┐ ┌──────────────┐ │
   │ │  WHS   │ │  │ │ Core │ │ Opt. Modules │ │
   │ │ Module │ │  │ │      │ │ (11 total)   │ │
   │ ├────────┤ │  │ └──────┘ └──────────────┘ │
   │ │  HVA   │ │  │                            │
   │ │ Module │ │  │                            │
   │ └────────┘ │  │                            │
   │            │◄─┤─── Direct API ────────────►│
   └────────────┘  └────────────────────────────┘
                    (when tenant has both products)
```

---

## Communication Patterns

### 1. Auth Validation (Every Request)

Every API request to SafeSpec or Nexum includes a session token issued by OpShield.

```
Product Request Flow:
  1. User's browser sends request with session cookie/token
  2. Product backend extracts token
  3. Product calls OpShield: GET /api/auth/validate
     Headers: Authorization: Bearer <token>
  4. OpShield returns: { user_id, email, tenant_memberships: [...] }
  5. Product loads tenant context and proceeds

Caching: Products cache validation results in Redis (TTL: 5 minutes)
         Cache invalidated on: logout, password change, session revocation
```

### 2. Entitlement Checks (Cached)

Products need to know what modules a tenant has access to.

```
Entitlement Flow:
  1. On first request per tenant (or cache miss):
     Product calls: GET /api/tenants/:id/entitlements
  2. OpShield returns full module map
  3. Product caches in Redis (TTL: 15 minutes, key: opshield:entitlements:{tenantId})
  4. Cache invalidated immediately via webhook when modules change

Webhook Events (OpShield → Products):
  POST /api/webhooks/opshield
  {
    "event": "module.activated" | "module.suspended" | "module.cancelled",
    "tenant_id": "uuid",
    "product_id": "safespec",
    "module_id": "whs",
    "timestamp": "ISO-8601"
  }
  Signed with HMAC-SHA256 (shared secret per product)
```

### 3. Product-to-Product (Direct)

SafeSpec and Nexum talk directly — OpShield is NOT a proxy.

```
SafeSpec → Nexum (when tenant has both):
  ─ Compliance status updates (webhook: status changed)
  ─ Licence/medical expiry alerts

Nexum → SafeSpec (when tenant has both):
  ─ Operational data (hours worked, loads carried)
  ─ Incident reports from DriverX
  ─ Pre-start checklist submissions

Authentication: HMAC-signed requests using API key stored in product_connections
Discovery: OpShield provides the partner product's API URL via entitlements response
```

---

## Module Enforcement: Complete Reference

### SafeSpec Module → Feature Mapping

| Feature Area | Required Module | If Not Subscribed |
|-------------|----------------|-------------------|
| Hazard Register | WHS | 403 + redirect to upgrade |
| Incident Reporting | WHS | 403 + redirect to upgrade |
| SWMS Builder | WHS | 403 + redirect to upgrade |
| JSA Builder | WHS | 403 + redirect to upgrade |
| Inspections (workplace) | WHS | 403 + redirect to upgrade |
| Corrective Actions | WHS | 403 + redirect to upgrade |
| Workers' Compensation | WHS | 403 + redirect to upgrade |
| RTW Plans | WHS | 403 + redirect to upgrade |
| Legislative Register | WHS | 403 + redirect to upgrade |
| Fatigue Management | HVA | 403 + redirect to upgrade |
| Mass Management | HVA | 403 + redirect to upgrade |
| Fitness to Drive | HVA | 403 + redirect to upgrade |
| SMS Builder (Safety Mgmt System) | HVA | 403 + redirect to upgrade |
| Audit Management | HVA | 403 + redirect to upgrade |
| Vehicle Registers | HVA | 403 + redirect to upgrade |
| Chain of Responsibility | HVA | 403 + redirect to upgrade |
| Preventive Maintenance | Fleet Maintenance (add-on to HVA) | 403 + redirect to upgrade |
| Defect Management | Fleet Maintenance (add-on to HVA) | 403 + redirect to upgrade |
| Work Orders | Fleet Maintenance (add-on to HVA) | 403 + redirect to upgrade |
| Worker Records (CRUD) | ANY module (shared) | Always accessible |
| Vehicle Records (CRUD) | ANY module (shared) | Always accessible |
| Company Profile | ANY module (shared) | Always accessible |
| Audit Log | ANY module (shared) | Always accessible |
| Dashboard | ANY module (shared) | Shows only data for subscribed modules |

### Nexum Module → Feature Mapping

| Feature Area | Required Module | If Not Subscribed |
|-------------|----------------|-------------------|
| Jobs | Core (always) | Always accessible |
| Business Entities | Core (always) | Always accessible |
| Scheduling | Core (always) | Always accessible |
| Dashboard | Core (always) | Always accessible |
| Invoice Generation | Invoicing | Hidden from nav, 403 on API |
| Credit Notes | Invoicing | Hidden from nav, 403 on API |
| RCTI Management | RCTI | Hidden from nav, 403 on API |
| Contractor Payments | RCTI | Hidden from nav, 403 on API |
| Xero Sync | Xero | Hidden from nav, 403 on API |
| Compliance Badges | Compliance + SafeSpec | Hidden, 403, requires SafeSpec |
| Pre-Start Integration | Compliance + SafeSpec | Hidden, 403, requires SafeSpec |
| SMS Messaging | SMS | Hidden from nav, 403 on API |
| Digital Dockets | Docket Processing | Hidden from nav, 403 on API |
| Material Types/Pricing | Materials | Hidden from nav, 403 on API |
| Route Planning | Map Planning | Hidden from nav, 403 on API |
| AI Job Parsing | AI Automation | Hidden from nav, 403 on API |
| Advanced Reports | Reporting | Hidden from nav, 403 on API |
| Contractor Portal | Portal | Disabled, 403 on API |

---

## Webhook Security

All webhooks between OpShield and products use HMAC-SHA256 signatures:

```
Headers:
  X-OpShield-Signature: sha256=<HMAC(secret, body)>
  X-OpShield-Timestamp: <unix-timestamp>
  X-OpShield-Event: <event-type>

Verification:
  1. Check timestamp is within 5 minutes of current time (replay protection)
  2. Compute HMAC-SHA256 of raw body with shared secret
  3. Compare with signature header (constant-time comparison)
  4. If mismatch → 401, log the attempt
```

---

## Failure Modes

### OpShield Down
- Products continue operating with cached auth and entitlements
- New logins fail (users see "Auth service unavailable")
- Module changes are delayed until OpShield recovers
- Sign-ups are unavailable

### Product Down
- OpShield shows "Service temporarily unavailable" for that product
- Other products unaffected
- Queued webhooks retry with exponential backoff

### Stripe Down
- Existing subscriptions continue (grace period)
- New sign-ups unavailable
- Plan changes queued for retry

---

## Environment Configuration

Each product needs these environment variables to connect to OpShield:

```env
# In SafeSpec and Nexum .env files
OPSHIELD_API_URL=http://localhost:3000    # dev
OPSHIELD_AUTH_URL=http://localhost:3000/api/auth
OPSHIELD_WEBHOOK_SECRET=<shared-secret>
OPSHIELD_API_KEY=<product-api-key>
```

OpShield needs connection details for product databases (provisioning only):

```env
# In OpShield .env
SAFESPEC_DATABASE_URL=postgresql://opshield_provisioner:***@localhost:5432/safespec_dev
NEXUM_DATABASE_URL=postgresql://opshield_provisioner:***@localhost:5432/nexum_dev

# Product API URLs (for webhooks)
SAFESPEC_API_URL=http://localhost:3001
NEXUM_API_URL=http://localhost:3002

# Product webhook secrets
SAFESPEC_WEBHOOK_SECRET=<secret>
NEXUM_WEBHOOK_SECRET=<secret>
```
