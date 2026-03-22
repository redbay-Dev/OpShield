-- Migration: Add migration state tracking tables for cross-product visibility
-- OpShield tracks which migration version each tenant is on, per product.

CREATE TABLE migration_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(50) NOT NULL UNIQUE,
  latest_version VARCHAR(255),
  total_migrations INTEGER NOT NULL DEFAULT 0,
  last_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE migration_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL,
  schema_name VARCHAR(100) NOT NULL,
  current_version VARCHAR(255),
  applied_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'current',
  error TEXT,
  last_migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX migration_state_product_idx ON migration_state (product_id);
CREATE INDEX migration_state_tenant_idx ON migration_state (tenant_id);
CREATE INDEX migration_state_status_idx ON migration_state (status);

CREATE TABLE migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(50) NOT NULL,
  action VARCHAR(30) NOT NULL,
  tenants_affected INTEGER NOT NULL DEFAULT 0,
  summary JSONB,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX migration_log_product_idx ON migration_log (product_id);
CREATE INDEX migration_log_created_at_idx ON migration_log (created_at);

-- Seed products
INSERT INTO migration_products (product_id) VALUES ('nexum'), ('safespec');
