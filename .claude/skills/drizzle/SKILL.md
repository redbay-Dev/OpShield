---
name: drizzle
description: Drizzle ORM patterns for OpShield — flat schema (NOT multi-tenant), migration conventions, query building, relation definitions, and Zod integration. Triggers when working with database schemas, migrations, ORM queries, or database operations.
user-invocable: false
---

# Drizzle ORM — OpShield Patterns

OpShield uses Drizzle ORM 0.45 with PostgreSQL 15, a **flat schema** (NOT multi-tenant), and Zod 4 integration via `drizzle-zod`.

## Flat Schema Architecture

### How It Works
- OpShield uses a single `public` schema — no schema-per-tenant
- All platform data lives in the public schema: tenants, users, Better Auth tables, billing, system config
- OpShield does NOT store business data — each product (Nexum, SafeSpec) owns its own DB
- Tenant records here are the registry that products reference for provisioning

### Soft Delete Middleware
```typescript
// Drizzle query middleware that automatically adds WHERE deleted_at IS NULL
// Handlers never manually filter deleted records
```

## Schema Definitions

### Table Standards (ALL tables)
```typescript
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

// Every table MUST have these columns
const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
};
```

### Core Tables
```typescript
// Tenant registry — products reference this for provisioning
export const tenants = pgTable('tenants', {
  ...baseColumns,
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  // subscription, settings, etc.
});

// Better Auth tables — THE auth instance for all products
// user, session, account, verification tables managed by Better Auth

// Billing tables — Stripe subscriptions, plans, usage
export const subscriptions = pgTable('subscriptions', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull(),
  stripePriceId: varchar('stripe_price_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  // ...
});

// Platform admin, system config, audit log
```

## Migration Conventions

### Rules
1. **Never modify existing migrations** — only add new ones
2. **Migrations are forward-only** — no auto-rollback, create corrective migrations instead
3. **Test migrations on a copy before applying to production**

### Migration Files
```
packages/backend/src/db/
  migrations/
    0001_create_tenants.ts
    0002_create_auth_tables.ts
    0003_create_billing_tables.ts
    0004_create_audit_log.ts
  schema/
    tenants.ts
    auth.ts
    billing.ts
    audit.ts
    index.ts       # Re-exports all tables
```

### Migration Commands
```bash
pnpm db:migrate           # Run all pending migrations
pnpm db:generate          # Generate migration from schema changes
```

## Query Patterns

### Basic CRUD
```typescript
// INSERT — always returns the created record
const tenant = await db.insert(tenants).values({
  name: 'Farrell Transport',
  slug: 'farrell-transport',
}).returning();

// SELECT — soft delete filter is automatic via middleware
const activeTenants = await db.select().from(tenants)
  .where(eq(tenants.status, 'active'));

// UPDATE — always update updatedAt
const updated = await db.update(tenants)
  .set({ name: 'New Name', updatedAt: new Date() })
  .where(eq(tenants.id, tenantId))
  .returning();

// SOFT DELETE — set deletedAt, never use db.delete()
const deleted = await db.update(tenants)
  .set({ deletedAt: new Date() })
  .where(eq(tenants.id, tenantId))
  .returning();
```

### Transactions
```typescript
// All write operations that touch multiple tables MUST use transactions
await db.transaction(async (tx) => {
  const tenant = await tx.insert(tenants).values({ ... }).returning();
  await tx.insert(subscriptions).values({ tenantId: tenant[0].id, ... });
  await tx.insert(auditLog).values({
    entityType: 'tenant',
    entityId: tenant[0].id,
    action: 'create',
    // ...
  });
  // If any step fails, everything rolls back
});
```

### Relations
```typescript
import { relations } from 'drizzle-orm';

export const tenantsRelations = relations(tenants, ({ many }) => ({
  subscriptions: many(subscriptions),
  users: many(tenantUsers),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
}));
```

## Drizzle-Zod Integration

```typescript
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Generate Zod schemas from Drizzle table definitions
export const selectTenantSchema = createSelectSchema(tenants);
export const insertTenantSchema = createInsertSchema(tenants, {
  // Override specific fields for validation
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

// Derive types from Zod (never define separately)
export type Tenant = z.infer<typeof selectTenantSchema>;
export type NewTenant = z.infer<typeof insertTenantSchema>;
```

## Indexing Rules
- Index ALL foreign key columns
- Index commonly queried fields (status, slug, stripe_subscription_id)
- Index `deleted_at` for soft delete filtering
- Composite indexes for common query patterns
- Unique indexes on external IDs (stripe_customer_id, stripe_subscription_id)

## Audit Logging
```typescript
// Every write operation must create an audit log entry
export const auditLog = pgTable('audit_log', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete
  previousData: jsonb('previous_data'), // snapshot before change
  newData: jsonb('new_data'),           // snapshot after change
  metadata: jsonb('metadata'),          // request context, IP, etc.
});
```
