import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Tracks migration state per product per tenant.
 * Products report their state after running migrations.
 * OpShield displays this in the platform admin dashboard.
 */
export const migrationState = pgTable(
  "migration_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: varchar("product_id", { length: 50 }).notNull(),
    tenantId: uuid("tenant_id").notNull(),
    schemaName: varchar("schema_name", { length: 100 }).notNull(),
    currentVersion: varchar("current_version", { length: 255 }),
    appliedCount: integer("applied_count").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("current"),
    error: text("error"),
    lastMigratedAt: timestamp("last_migrated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("migration_state_product_idx").on(table.productId),
    index("migration_state_tenant_idx").on(table.tenantId),
    index("migration_state_status_idx").on(table.status),
  ],
);

/**
 * Tracks the latest reported migration version per product.
 * One row per product (nexum, safespec).
 */
export const migrationProducts = pgTable("migration_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: varchar("product_id", { length: 50 }).notNull().unique(),
  latestVersion: varchar("latest_version", { length: 255 }),
  totalMigrations: integer("total_migrations").notNull().default(0),
  lastReportedAt: timestamp("last_reported_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log for migration events (reports received, migrations triggered).
 */
export const migrationLog = pgTable(
  "migration_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: varchar("product_id", { length: 50 }).notNull(),
    action: varchar("action", { length: 30 }).notNull(),
    tenantsAffected: integer("tenants_affected").notNull().default(0),
    summary: jsonb("summary"),
    triggeredBy: text("triggered_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("migration_log_product_idx").on(table.productId),
    index("migration_log_created_at_idx").on(table.createdAt),
  ],
);
