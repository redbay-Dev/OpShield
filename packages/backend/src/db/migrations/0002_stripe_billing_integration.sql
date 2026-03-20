-- Stripe Billing Integration — Phase 1

-- 1. Modify subscriptions table
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "product_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "cancel_at_period_end";
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscriptions" ADD COLUMN "stripe_coupon_id" varchar(255);

-- 2. Add per-user price ID to plans
ALTER TABLE "plans" ADD COLUMN "stripe_per_user_price_id" varchar(255);

-- 3. Create subscription_items table
CREATE TABLE "subscription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id"),
	"stripe_item_id" varchar(255),
	"plan_id" uuid NOT NULL REFERENCES "plans"("id"),
	"module_id" varchar(50) NOT NULL,
	"product_id" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Create tenant_usage table
CREATE TABLE "tenant_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"product_id" varchar(50) NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"metric" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb,
	"reported_by" varchar(100) NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Create billing_events table
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid REFERENCES "tenants"("id"),
	"event_type" varchar(100) NOT NULL,
	"stripe_event_id" varchar(255) NOT NULL,
	"amount_cents" integer,
	"currency" varchar(3),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
