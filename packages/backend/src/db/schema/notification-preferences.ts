import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Per-user notification preferences.
 * Controls which non-essential emails are sent.
 * Critical emails (payment-failed, suspension, security) always bypass.
 */
export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  billingEmails: boolean("billing_emails").notNull().default(true),
  supportEmails: boolean("support_emails").notNull().default(true),
  productUpdates: boolean("product_updates").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
