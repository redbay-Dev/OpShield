import { pgTable, uuid, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { tenants } from "./tenants.js";

/**
 * Impersonation tokens for platform admins to log into products as tenant owners.
 * Tokens are SHA-256 hashed (raw token shown once). 30-minute expiry.
 */
export const impersonationTokens = pgTable("impersonation_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => user.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  product: varchar("product", { length: 50 }).notNull(),
  reason: text("reason").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
