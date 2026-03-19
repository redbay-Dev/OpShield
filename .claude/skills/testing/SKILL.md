---
name: testing
description: Test patterns for OpShield — unit tests (Vitest 4), integration tests (API routes against test DB), and E2E tests (Playwright 1.58). Covers test database setup, seeding, cleanup, and conventions. Triggers when writing tests, setting up test infrastructure, or debugging test failures.
user-invocable: false
---

# Testing — OpShield Patterns

OpShield uses Vitest 4 for unit and integration tests, Playwright 1.58 for E2E tests.

## Principles

1. **Every feature ships with tests** — no exceptions
2. **No mocking the database** — use the test database for integration tests
3. **External services mocked at HTTP boundary** — Stripe, product APIs
4. **Auth flows, billing, and permissions MUST have tests**
5. **Test file co-located with source** — `provisioning.ts` → `provisioning.test.ts`

## Test Structure

```
packages/
  backend/
    src/
      routes/tenants/
        create.ts
        create.test.ts          # Integration test for the route
      services/
        provisioning.ts
        provisioning.test.ts    # Unit test for business logic
        stripe-billing.ts
        stripe-billing.test.ts  # Unit test for billing logic
  frontend/
    src/
      components/
        PricingCard.tsx
        PricingCard.test.tsx    # Component test
  shared/
    src/
      schemas/
        tenant.ts
        tenant.test.ts          # Schema validation test
      utils/
        slug.ts
        slug.test.ts            # Utility function test
  e2e/                          # Playwright E2E tests
    auth.spec.ts
    signup.spec.ts
    admin.spec.ts
```

## Unit Tests (Vitest 4)

### What to Unit Test
- Business logic functions (tenant provisioning, subscription management)
- Zod schema validation (shared schemas tested once)
- Utility functions and helpers
- State management (Zustand stores)
- Pure functions with clear inputs/outputs

### Pattern
```typescript
import { describe, it, expect } from 'vitest';
import { provisionTenant } from './provisioning';

describe('provisionTenant', () => {
  it('should create tenant record and return provisioning result', () => {
    const result = provisionTenant({
      name: 'Test Company',
      slug: 'test-company',
      plan: 'professional',
    });
    expect(result.tenantId).toBeDefined();
    expect(result.status).toBe('provisioning');
  });

  it('should reject duplicate slugs', () => {
    expect(() => provisionTenant({
      name: 'Test Company',
      slug: 'existing-slug',
      plan: 'professional',
    })).toThrow('Slug already in use');
  });
});
```

### Zod Schema Tests
```typescript
import { describe, it, expect } from 'vitest';
import { createTenantSchema } from './tenant';

describe('createTenantSchema', () => {
  it('should accept valid tenant data', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test Company',
      slug: 'test-company',
      plan: 'professional',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid slug format', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test Company',
      slug: 'Invalid Slug!',
    });
    expect(result.success).toBe(false);
  });
});
```

## Integration Tests (Vitest 4 + Supertest)

### What to Integration Test
- API route handlers end-to-end (request → validation → handler → database → response)
- Authentication and permission checks
- Stripe webhook processing
- Error responses (400, 401, 403, 404, 409)

### Test Database Setup
```typescript
// packages/backend/src/test-utils/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Use the shared PostgreSQL on the dev server
// Create an opshield_test database

beforeAll(async () => {
  // Run migrations on test database
  // Seed test data
});

afterAll(async () => {
  // Clean up test database connections
});

beforeEach(async () => {
  // Reset data to known state (truncate + reseed)
  // Don't reset between individual tests — too slow
  // Reset between test SUITES
});
```

### Route Test Pattern
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../server';

describe('POST /api/v1/tenants', () => {
  let app: FastifyInstance;
  let authCookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    authCookie = await loginAsTestUser(app, 'admin@redbay.dev');
  });

  it('should create a tenant with valid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      headers: { cookie: authCookie },
      payload: {
        name: 'Test Company',
        slug: 'test-company',
        plan: 'professional',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.slug).toBe('test-company');
  });

  it('should return 400 for invalid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      headers: { cookie: authCookie },
      payload: { /* missing required fields */ },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 403 without admin permission', async () => {
    const regularCookie = await loginAsTestUser(app, 'user@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      headers: { cookie: regularCookie },
      payload: { name: 'Test', slug: 'test', plan: 'starter' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 401 without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      payload: { name: 'Test', slug: 'test', plan: 'starter' },
    });

    expect(response.statusCode).toBe(401);
  });
});
```

## E2E Tests (Playwright 1.58)

### What to E2E Test
- Sign-up flow: registration, email verification, redirect to product
- Login flow: authentication, session management, SSO across products
- Billing: subscription selection, Stripe checkout, plan management
- Admin dashboard: tenant management, user management, system health
- Public website: marketing pages, pricing page

### Pattern
```typescript
import { test, expect } from '@playwright/test';

test.describe('Sign Up Flow', () => {
  test('should complete sign-up and redirect to product', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[name="name"]', 'Test Company');
    await page.fill('[name="email"]', 'admin@testco.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.selectOption('[name="plan"]', 'professional');
    await page.click('button[type="submit"]');

    // Verify redirect to billing/checkout
    await expect(page).toHaveURL(/\/checkout/);
  });
});
```

### E2E Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

## Seed Data

### Test Users

**Platform Admin ("admin@redbay.dev")** — Full platform admin access:
- Can manage all tenants, users, billing
- Can access admin dashboard

**Regular User ("user@example.com")** — Standard user:
- Belongs to a test tenant
- Cannot access admin routes

### Test Tenants

**Tenant A ("Farrell Transport")** — Active, professional plan:
- Active subscription
- Multiple users

**Tenant B ("Smith Haulage")** — Active, starter plan:
- Active subscription
- Single user

**Tenant C ("Suspended Co")** — Suspended:
- Overdue subscription
- Used to test access restrictions

### Seed Commands
```bash
pnpm db:seed          # Full seed for development
pnpm db:seed:test     # Minimal seed for test suite (faster)
```

## Mocking External Services

```typescript
// Mock at the HTTP boundary, not at the service layer
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  // Stripe API
  http.post('https://api.stripe.com/v1/customers', () => {
    return HttpResponse.json({ id: 'cus_mock123' });
  }),

  http.post('https://api.stripe.com/v1/subscriptions', () => {
    return HttpResponse.json({ id: 'sub_mock123', status: 'active' });
  }),

  // Product APIs (for tenant provisioning callbacks)
  http.post('http://localhost:3001/api/v1/internal/provision', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('http://localhost:3002/api/v1/internal/provision', () => {
    return HttpResponse.json({ success: true });
  }),
];

const mockServer = setupServer(...handlers);

beforeAll(() => mockServer.listen());
afterAll(() => mockServer.close());
afterEach(() => mockServer.resetHandlers());
```

## Test Commands

```bash
pnpm test              # All tests (unit + integration)
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:e2e          # E2E tests (Playwright)
pnpm test -- --watch   # Watch mode
pnpm test -- billing   # Run tests matching "billing"
```

## Checklist for Every New Feature

- [ ] Unit tests for business logic (pure functions, calculations, validations)
- [ ] Integration tests for API routes (happy path + error path minimum)
- [ ] Auth flow tests for any auth changes
- [ ] Billing/Stripe tests for any billing changes
- [ ] Permission checks have tests
- [ ] External services mocked at HTTP boundary
- [ ] Test file co-located with source
- [ ] Descriptive test names: `it('should reject tenant creation when subscription is suspended')`
