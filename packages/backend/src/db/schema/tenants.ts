import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Tenant registry — one row per paying customer across all Redbay products.
 * OpShield uses a flat schema (no multi-tenancy). This IS the tenant registry.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("onboarding"),
  billingEmail: varchar("billing_email", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Modules that a tenant has access to.
 * Source of truth for entitlements — products query this via API.
 */
export const tenantModules = pgTable("tenant_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  productId: varchar("product_id", { length: 50 }).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  maxUsers: integer("max_users").notNull().default(5),
  currentUsers: integer("current_users").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * SSO provider configuration per tenant.
 * Enterprise tenants can connect their own Azure AD.
 */
export const tenantSsoProviders = pgTable("tenant_sso_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  provider: varchar("provider", { length: 50 }).notNull(),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  clientSecret: text("client_secret").notNull(),
  tenantIdAzure: varchar("tenant_id_azure", { length: 255 }),
  enforced: boolean("enforced").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Platform admin users (Redbay staff).
 * Separate from tenant users — these manage the platform itself.
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Service API keys for product backends (SafeSpec, Nexum) to call OpShield APIs.
 * Keys are SHA-256 hashed — raw key is shown only once at creation time.
 */
export const serviceApiKeys = pgTable("service_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: varchar("product_id", { length: 50 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
  keyHash: text("key_hash").notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdBy: text("created_by").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Provisioning status for each product per tenant.
 * Tracks whether each product has successfully set up its tenant schema.
 */
export const tenantProvisioning = pgTable("tenant_provisioning", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  productId: varchar("product_id", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log for platform-level actions.
 * Tracks tenant creation, module changes, billing events, admin actions.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").notNull(),
  actorType: varchar("actor_type", { length: 20 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
