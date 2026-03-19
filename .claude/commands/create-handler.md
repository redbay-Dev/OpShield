Scaffold a new Fastify API route handler with all required boilerplate: Zod validation, permission check, audit logging, error handling, and a test file.

## Usage
`/create-handler [name]` — e.g., `/create-handler tenants/create`, `/create-handler billing/subscriptions/list`

## Steps

### 1. Determine Route Details
From the name, determine:
- Route path (e.g., `tenants/create` → `POST /api/v1/tenants`)
- HTTP method (create=POST, list=GET, get=GET, update=PATCH, delete=DELETE)
- Package location: `packages/backend/src/routes/{area}/`

### 2. Create Zod Schemas (if not existing)
In `packages/shared/src/schemas/{area}.ts`:
- Request body schema (for POST/PATCH)
- Query params schema (for GET with filters)
- Response schema
- Derive TypeScript types with `z.infer<>`
- Use Zod 4 syntax

### 3. Create Route Handler
In `packages/backend/src/routes/{area}/{name}.ts`:

```typescript
// Template structure — adapt to specific route
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// Import schemas from @shared/

export async function registerRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/{path}', {
    schema: {
      // Zod schemas for validation
    },
    preHandler: [
      // Authentication check
      // Permission check (platform admin for admin routes)
    ],
  }, async (request, reply) => {
    // 1. Permission check (FIRST)
    // 2. Validate input (automatic via schema)
    // 3. Business logic
    // 4. Audit log entry (for writes)
    // 5. Return response
  });
}
```

Every handler MUST have:
- [ ] Zod input validation (auto-400 on failure)
- [ ] Authentication check
- [ ] Permission check (deny by default)
- [ ] Consistent error response format
- [ ] Audit log entry for write operations
- [ ] Explicit TypeScript return types

### 4. Create Test File
In `packages/backend/src/routes/{area}/{name}.test.ts`:
- Happy path test (valid input → expected output)
- Validation error test (invalid input → 400)
- Permission denied test (no permission → 403)
- Unauthenticated test (no session → 401)
- Not found test (invalid ID → 404)

### 5. Register Route
- Add the route to the appropriate route registration file
- Ensure it's imported in the Fastify plugin structure

### 6. Report
Print what was created:
- Schema file path
- Handler file path
- Test file path
- What the route does and its HTTP method/path
- Reminder to implement the business logic (the scaffold has TODO comments)
