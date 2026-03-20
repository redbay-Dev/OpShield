# 09 — Platform API Contracts

> Versioning, shared types, rate limiting, and resilience patterns for the APIs that connect OpShield, SafeSpec, and Nexum.

## Overview

OpShield exposes APIs that SafeSpec and Nexum depend on. These are **platform contracts** — breaking them breaks products. This doc defines how those contracts are managed.

---

## API Versioning

### Strategy: URL-Prefixed Versioning

All platform APIs are prefixed with a version:

```
/api/v1/tenants/:id/entitlements
/api/v1/support/tickets
/api/v1/auth/validate
/api/v1/internal/usage/users
```

### Version Lifecycle

| State | Meaning | Duration |
|-------|---------|----------|
| **Current** | Active, receives new features | Indefinite |
| **Deprecated** | Still works, logs warnings, no new features | 6 months minimum |
| **Retired** | Returns 410 Gone | After deprecation period |

### Breaking vs Non-Breaking Changes

**Non-breaking (no version bump):**
- Adding new optional fields to responses
- Adding new endpoints
- Adding new webhook event types
- Relaxing validation (accepting more input)

**Breaking (requires new version):**
- Removing or renaming response fields
- Changing field types
- Removing endpoints
- Changing required fields in requests
- Changing authentication mechanism

### Changelog

Every API change is logged in `docs/API-CHANGELOG.md`:

```markdown
## v1 Changelog

### 2026-03-25
- Added `max_users` field to entitlements response (non-breaking)

### 2026-03-20
- Initial v1 release: entitlements, support, auth validation, usage reporting
```

---

## Shared Types Package: `@redbay/platform-types`

A lightweight TypeScript package containing only type definitions and Zod schemas for the platform contract. Published to a private npm registry or consumed via workspace path.

### Location

```
OpShield/
  packages/
    platform-types/           # NEW — shared types package
      src/
        entitlements.ts       # Entitlement response types + Zod schemas
        webhooks.ts           # Webhook event types + Zod schemas
        support.ts            # Support ticket types + Zod schemas
        modules.ts            # Module ID enums + product registry
        usage.ts              # Usage reporting types
        index.ts              # Re-exports everything
      package.json            # @redbay/platform-types
      tsconfig.json
```

### Consumption

Products consume this package:

```json
// SafeSpec package.json
{
  "dependencies": {
    "@redbay/platform-types": "file:../../OpShield/packages/platform-types"
  }
}

// Or via private registry:
{
  "dependencies": {
    "@redbay/platform-types": "^1.0.0"
  }
}
```

### Example Types

```typescript
// packages/platform-types/src/entitlements.ts
import { z } from 'zod';

export const moduleStatusSchema = z.enum(['active', 'suspended', 'cancelled']);
export type ModuleStatus = z.infer<typeof moduleStatusSchema>;

export const safespecModuleIdSchema = z.enum(['whs', 'hva', 'fleet_maintenance']);
export type SafeSpecModuleId = z.infer<typeof safespecModuleIdSchema>;

export const nexumModuleIdSchema = z.enum([
  'invoicing', 'rcti', 'xero', 'compliance', 'sms',
  'docket_processing', 'materials', 'map_planning',
  'ai_automation', 'reporting', 'portal',
]);
export type NexumModuleId = z.infer<typeof nexumModuleIdSchema>;

export const entitlementResponseSchema = z.object({
  tenant_id: z.string().uuid(),
  products: z.record(z.object({
    status: moduleStatusSchema,
    plan: z.string(),
    included_users: z.number(),
    max_users: z.number().nullable(),
    modules: z.record(z.object({
      status: moduleStatusSchema,
      plan: z.string().optional(),
      included_users: z.number().optional(),
    })),
  })),
});
export type EntitlementResponse = z.infer<typeof entitlementResponseSchema>;

// packages/platform-types/src/webhooks.ts
export const webhookEventSchema = z.object({
  event: z.enum([
    'module.activated', 'module.suspended', 'module.cancelled', 'module.plan_changed',
    'tenant.suspended', 'tenant.reactivated', 'tenant.deleted',
    'session.revoked',
  ]),
  tenant_id: z.string().uuid(),
  product_id: z.string(),
  module_id: z.string().optional(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional(),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
```

### Versioning the Types Package

- Types package version follows semver
- Breaking type changes = major version bump
- Products pin to compatible range (`^1.0.0`)
- CI checks that products compile against the latest types

---

## Rate Limiting

### OpShield API Limits

| Endpoint Category | Limit | Window | Applies To |
|------------------|-------|--------|-----------|
| Auth validation (`/api/v1/auth/*`) | 100 req | per minute | per product API key |
| Entitlements (`/api/v1/tenants/*/entitlements`) | 60 req | per minute | per product API key |
| Support (`/api/v1/support/*`) | 30 req | per minute | per tenant |
| Usage reporting (`/api/v1/internal/*`) | 10 req | per minute | per product API key |
| Admin (`/api/v1/admin/*`) | 120 req | per minute | per admin user |
| Webhook receive (`/api/webhooks/*`) | 100 req | per minute | per source |

### Implementation

```typescript
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  global: false, // Apply per-route, not globally
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    // Rate limit by product API key for inter-service calls
    return request.headers['x-product-api-key'] ?? request.ip;
  },
});
```

### Rate Limit Headers

All responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711929660
```

When exceeded: `429 Too Many Requests` with `Retry-After` header.

---

## Resilience Patterns

### Circuit Breaker (Products → OpShield)

Products implement a circuit breaker for OpShield API calls:

```
States:
  CLOSED (normal):
    → All requests go through
    → Track failure count

  OPEN (OpShield down):
    → Requests fail immediately (don't wait for timeout)
    → Fall back to cached data
    → After 30 seconds, transition to HALF_OPEN

  HALF_OPEN (testing recovery):
    → Allow one request through
    → If success → CLOSED
    → If failure → OPEN again
```

### Fallback Behaviour

| Scenario | Product Behaviour |
|----------|------------------|
| OpShield auth down (< 5 min) | Accept existing local sessions, reject new logins |
| OpShield auth down (> 5 min) | Show "Auth service temporarily unavailable" on login page |
| OpShield entitlements down | Use cached entitlements (last known state). Allow all if no cache. |
| OpShield support API down | Queue support tickets locally, send via email fallback |
| Webhook delivery failed | OpShield retries with exponential backoff (1s, 5s, 30s, 5m, 30m) |

### Health Check Contract

Products expose `/api/health` for OpShield to poll:

```typescript
// Standard health response
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.2.3",
  "uptime_seconds": 864000,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "opshield_auth": "ok" | "degraded" | "unreachable"
  }
}
```

OpShield polls every 60 seconds. Alerts after 3 consecutive failures.

---

## Webhook Delivery Guarantees

### At-Least-Once Delivery

Webhooks may be delivered more than once. Products must be **idempotent**:

```typescript
// Product webhook handler
app.post('/api/webhooks/opshield', async (request, reply) => {
  const event = request.body;

  // Idempotency: check if we've already processed this event
  const processed = await redis.get(`webhook:${event.id}`);
  if (processed) {
    return reply.status(200).send({ status: 'already_processed' });
  }

  // Process the event
  await handleWebhookEvent(event);

  // Mark as processed (TTL: 24 hours)
  await redis.set(`webhook:${event.id}`, '1', 'EX', 86400);

  return reply.status(200).send({ status: 'ok' });
});
```

### Retry Schedule

If a webhook delivery fails (non-2xx response or timeout):

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 second |
| 3 | 5 seconds |
| 4 | 30 seconds |
| 5 | 5 minutes |
| 6 | 30 minutes |
| 7 | 2 hours |
| 8 (final) | 12 hours |

After 8 failures: event marked as `failed`, alert in Platform Admin.

---

## Development Workflow Across Repos

### Local Development

All three projects run simultaneously on the dev server:

```bash
# Terminal 1: OpShield
cd /home/redbay/OpShield && pnpm dev    # API :3000, Frontend :5170

# Terminal 2: SafeSpec
cd /home/redbay/saas-project && pnpm dev  # API :3001, Frontend :5173

# Terminal 3: Nexum
cd /home/redbay/Nexum-SaaS && pnpm dev    # API :3002, Frontend :5174
```

### Shared Types Sync

When platform types change:
1. Edit types in `OpShield/packages/platform-types/`
2. Run `pnpm build` in platform-types
3. SafeSpec and Nexum pick up changes via workspace link
4. TypeScript compiler catches any breaking changes in products

### Cross-Repo Testing

Integration tests that verify the full flow:

```bash
# In OpShield: test that entitlements API returns correct shape
pnpm test:integration

# In SafeSpec: test that middleware correctly parses entitlements
# (uses mocked OpShield responses matching platform-types schemas)
pnpm test:integration

# Full stack: manual smoke test with all three running
# Login → product selection → module access → support ticket
```
