-- Outbound Webhook Delivery Log

CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"http_status" integer,
	"error" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
