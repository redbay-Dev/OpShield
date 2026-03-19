---
name: fastify
description: Fastify route patterns for OpShield — route registration, plugin structure, hook lifecycle, schema validation with Zod 4, error handling, and authentication/permission middleware. Triggers when working with API routes, middleware, plugins, or server configuration.
user-invocable: false
---

# Fastify — OpShield Patterns

OpShield uses Fastify 5 with `fastify-type-provider-zod` v6 for type-safe route schemas using Zod 4.

## Server Setup

```typescript
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();

// Set Zod as the validation and serialization compiler
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

## Plugin Structure

```
packages/backend/src/
  server.ts              # Fastify instance creation and plugin registration
  plugins/
    auth.ts              # Better Auth integration (THE auth instance)
    permission.ts        # Permission check middleware
    audit.ts             # Audit logging middleware
    cors.ts              # @fastify/cors configuration
    swagger.ts           # @fastify/swagger + @scalar/api-reference
    rate-limit.ts        # Redis-backed rate limiting
    stripe.ts            # Stripe webhook handling
  routes/
    auth/                # /api/v1/auth/* — Better Auth SSO endpoints
    tenants/             # /api/v1/tenants/* — Tenant provisioning
    billing/             # /api/v1/billing/* — Stripe subscriptions, plans, usage
    admin/               # /api/v1/admin/* — Platform admin (Redbay staff)
    users/               # /api/v1/users/* — User management
    webhooks/            # /api/v1/webhooks/* — Stripe, product callbacks
    health/              # /api/v1/health/* — Health checks
```

## Route Registration

### Plugin Pattern
Every route group is a Fastify plugin:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const tenantRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Routes registered here inherit the /api/v1/tenants prefix
  typedApp.get('/', { /* list tenants */ });
  typedApp.post('/', { /* create tenant */ });
  typedApp.get('/:id', { /* get tenant */ });
  typedApp.patch('/:id', { /* update tenant */ });
  typedApp.delete('/:id', { /* soft delete tenant */ });
};

export default tenantRoutes;
```

### Route with Full Schema
```typescript
import { z } from 'zod';
import { createTenantSchema, tenantResponseSchema } from '@shared/schemas/tenants';

typedApp.post('/', {
  schema: {
    body: createTenantSchema,
    response: {
      201: tenantResponseSchema,
      400: errorResponseSchema,
      403: errorResponseSchema,
    },
  },
  preHandler: [
    app.authenticate,       // Verify session
    app.requirePermission('tenants.create'),  // Check permission (platform admin)
  ],
}, async (request, reply) => {
  // request.body is fully typed from createTenantSchema
  const tenant = await createTenant(request.body);

  // Audit log
  await request.audit('tenant', tenant.id, 'create', null, tenant);

  return reply.status(201).send(tenant);
});
```

## Hook Lifecycle

Fastify hooks execute in this order for each request:

1. `onRequest` — Runs first. Use for: CORS, rate limiting
2. `preParsing` — Before body parsing. Use for: raw body access (Stripe webhooks)
3. `preValidation` — Before schema validation. Use for: authentication
4. `preHandler` — After validation, before handler. Use for: permission checks
5. `preSerialization` — Before response serialization
6. `onSend` — Before sending response. Use for: response headers
7. `onResponse` — After response sent. Use for: logging, metrics

### Where OpShield Middleware Runs

| Middleware | Hook | Purpose |
|-----------|------|---------|
| CORS | `onRequest` | Allow configured origins (product frontends) |
| Rate limiting | `onRequest` | Redis-backed per IP/key |
| Authentication | `preValidation` | Verify session cookie or API key |
| Permission check | `preHandler` | Verify user has required permission |
| Stripe raw body | `preParsing` | Preserve raw body for webhook verification |
| Audit logging | Built into handlers | After successful write operations |

## Error Handling

### Consistent Error Format
```typescript
// Every error response follows this shape
const errorResponseSchema = z.object({
  error: z.string(),       // Human-readable message
  code: z.string(),        // Machine-readable code (e.g., 'VALIDATION_ERROR')
  details: z.unknown().optional(), // Field-level errors for validation
});
```

### Error Handler
```typescript
app.setErrorHandler((error, request, reply) => {
  // Zod validation errors → 400
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.validation,
    });
  }

  // Authentication errors → 401
  // Permission errors → 403
  // Not found → 404
  // Conflict → 409 (concurrent modification)
  // Everything else → 500 (log stack trace, return generic message)
});
```

## Authentication Middleware

### Session-Based (Web App / Product Frontends)
```typescript
// Better Auth cookie-based sessions — THE auth instance for all products
// Middleware extracts session from cookie, validates against PostgreSQL
// Sets request.user
app.decorateRequest('user', null);
```

### API Key (Product-to-Platform Communication)
```typescript
// Bearer token in Authorization header
// Used by Nexum and SafeSpec to validate sessions, provision tenants
// Scoped permissions per key
```

## Permission Middleware

```typescript
// DENY BY DEFAULT — every route must declare its permission
// Routes without permission checks will fail CI

function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const hasPermission = await checkPermission(
      request.user.id,
      permission,
    );
    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        details: { required: permission },
      });
    }
  };
}
```

## API Documentation

```typescript
// @fastify/swagger generates OpenAPI spec from Zod schemas
// @scalar/api-reference serves interactive docs at /api/docs
import scalar from '@scalar/fastify-api-reference';

await app.register(scalar, {
  routePrefix: '/api/docs',
  configuration: {
    spec: { url: '/api/docs/openapi.json' },
    theme: 'default',
  },
});
```

## Checklist for Every New Route

- [ ] Zod schema for request body/params/query (in `@shared/`)
- [ ] Zod schema for response (in `@shared/`)
- [ ] `app.authenticate` in preHandler
- [ ] `app.requirePermission('scope.action')` in preHandler
- [ ] Consistent error response format
- [ ] Audit log entry for write operations
- [ ] Integration test (happy path + error path)
- [ ] Explicit TypeScript return types
