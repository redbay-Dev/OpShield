import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/**
 * Stripe subscriptions tracked in OpShield.
 * One subscription per tenant-product combination.
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 })
    .notNull()
    .unique(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
  productId: varchar("product_id", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: timestamp("cancel_at_period_end", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Billing plans available in the system.
 * Maps to Stripe products/prices.
 */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 50 }).notNull(),
  moduleId: varchar("module_id", { length: 50 }),
  tier: varchar("tier", { length: 50 }).notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  includedUsers: integer("included_users").notNull().default(5),
  perUserPrice: numeric("per_user_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  billingInterval: varchar("billing_interval", { length: 20 })
    .notNull()
    .default("monthly"),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: varchar("is_active", { length: 5 }).notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Invoice records synced from Stripe.
 */
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 })
    .notNull()
    .unique(),
  status: varchar("status", { length: 30 }).notNull(),
  amountDue: integer("amount_due").notNull(),
  amountPaid: integer("amount_paid").notNull().default(0),
  currency: varchar("currency", { length: 3 }).notNull().default("aud"),
  invoiceUrl: text("invoice_url"),
  pdfUrl: text("pdf_url"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
