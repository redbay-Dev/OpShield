import { relations } from "drizzle-orm";
import { pgTable, uuid, text, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { tenants } from "./tenants.js";

/**
 * Join table: users ↔ tenants.
 * A user can belong to multiple tenants (e.g., contractor working for
 * multiple companies). This replaces the tenantId on user.
 */
export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("tenant_users_user_tenant_uniq").on(table.userId, table.tenantId)],
);

// ── Relations ──

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  user: one(user, {
    fields: [tenantUsers.userId],
    references: [user.id],
  }),
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
  }),
}));
