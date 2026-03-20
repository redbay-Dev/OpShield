import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/**
 * Stripe subscriptions tracked in OpShield.
 * One subscription per tenant (covers all modules).
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 })
    .notNull()
    .unique(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  stripeCouponId: varchar("stripe_coupon_id", { length: 255 }),
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
  stripePerUserPriceId: varchar("stripe_per_user_price_id", { length: 255 }),
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
 * Line items per subscription — one per module.
 * Links a subscription to a plan and tracks Stripe item ID + quantity.
 */
export const subscriptionItems = pgTable("subscription_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  stripeItemId: varchar("stripe_item_id", { length: 255 }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  productId: varchar("product_id", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Append-only user count tracking per tenant/module.
 * Products report usage; OpShield uses it for billing calculations.
 */
export const tenantUsage = pgTable("tenant_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  productId: varchar("product_id", { length: 50 }).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  metric: varchar("metric", { length: 50 }).notNull(),
  value: integer("value").notNull(),
  breakdown: jsonb("breakdown").$type<Record<string, unknown>>().default({}),
  reportedBy: varchar("reported_by", { length: 100 }).notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Immutable Stripe event log for idempotent webhook processing.
 */
export const billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
  amountCents: integer("amount_cents"),
  currency: varchar("currency", { length: 3 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
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
