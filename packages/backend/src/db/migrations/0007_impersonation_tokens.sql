CREATE TABLE IF NOT EXISTS "impersonation_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "admin_user_id" text NOT NULL REFERENCES "user"("id"),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "product" varchar(50) NOT NULL,
  "reason" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_impersonation_token_hash" ON "impersonation_tokens"("token_hash");
