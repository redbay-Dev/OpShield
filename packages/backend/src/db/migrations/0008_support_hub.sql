-- Support Hub tables
-- Centralized ticketing for all Redbay products

-- Ticket number sequence for human-readable IDs
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 1;

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_number" varchar(20) NOT NULL UNIQUE,
  "product_id" varchar(50) NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "user_id" text NOT NULL,
  "user_email" varchar(255) NOT NULL,
  "user_name" varchar(255) NOT NULL,
  "category" varchar(30) NOT NULL DEFAULT 'other',
  "subject" varchar(500) NOT NULL,
  "description" text NOT NULL,
  "page_url" text,
  "browser_info" jsonb,
  "priority" varchar(20) NOT NULL DEFAULT 'medium',
  "status" varchar(30) NOT NULL DEFAULT 'open',
  "assigned_to" uuid,
  "tags" text[] NOT NULL DEFAULT '{}',
  "email_thread_id" text,
  "resolved_at" timestamptz,
  "closed_at" timestamptz,
  "first_response_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id"),
  "sender_type" varchar(20) NOT NULL,
  "sender_id" text NOT NULL,
  "sender_name" varchar(255) NOT NULL,
  "sender_email" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "body_html" text,
  "is_internal_note" boolean NOT NULL DEFAULT false,
  "email_message_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id"),
  "message_id" uuid REFERENCES "support_messages"("id"),
  "file_name" varchar(500) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "storage_key" text NOT NULL,
  "uploaded_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "canned_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "category" varchar(30),
  "product_id" varchar(50),
  "usage_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_support_tickets_tenant" ON "support_tickets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets" ("status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_support_tickets_priority" ON "support_tickets" ("priority") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_support_tickets_product" ON "support_tickets" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_assigned" ON "support_tickets" ("assigned_to") WHERE "assigned_to" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_support_tickets_created" ON "support_tickets" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_support_messages_ticket" ON "support_messages" ("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_support_attachments_ticket" ON "support_attachments" ("ticket_id");
