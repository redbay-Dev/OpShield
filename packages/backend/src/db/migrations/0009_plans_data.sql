-- Initial pricing plans from docs/04-BILLING-PRICING-MODEL.md
-- These are reference/configuration data, not seed data.

-- SafeSpec WHS tiers
INSERT INTO "plans" ("name", "product_id", "module_id", "tier", "base_price", "included_users", "per_user_price", "billing_interval", "features")
VALUES
  ('WHS Starter', 'safespec', 'safespec-whs', 'starter', '49.00', 5, '5.00', 'monthly', '["Hazard Register", "Incident Reporting", "Basic Inspections"]'),
  ('WHS Growth', 'safespec', 'safespec-whs', 'growth', '99.00', 15, '4.00', 'monthly', '["All Starter features", "SWMS Builder", "Corrective Actions", "Custom Templates"]'),
  ('WHS Business', 'safespec', 'safespec-whs', 'business', '199.00', 50, '3.00', 'monthly', '["All Growth features", "API Access", "SSO", "Priority Support"]')
ON CONFLICT DO NOTHING;

-- SafeSpec HVA tiers
INSERT INTO "plans" ("name", "product_id", "module_id", "tier", "base_price", "included_users", "per_user_price", "billing_interval", "features")
VALUES
  ('HVA Solo Operator', 'safespec', 'safespec-hva', 'solo_operator', '39.00', 3, '8.00', 'monthly', '["Fatigue Management", "Mass Management", "Basic Compliance"]'),
  ('HVA Small Fleet', 'safespec', 'safespec-hva', 'small_fleet', '89.00', 10, '6.00', 'monthly', '["All Solo features", "SMS Builder", "CoR Management", "Fitness to Drive"]'),
  ('HVA Medium Fleet', 'safespec', 'safespec-hva', 'medium_fleet', '189.00', 25, '5.00', 'monthly', '["All Small Fleet features", "Fleet Maintenance", "API Access", "SSO"]')
ON CONFLICT DO NOTHING;

-- SafeSpec Fleet Maintenance (HVA add-on, flat price, inherits HVA user count)
INSERT INTO "plans" ("name", "product_id", "module_id", "tier", "base_price", "included_users", "per_user_price", "billing_interval", "features")
VALUES
  ('Fleet Maintenance', 'safespec', 'safespec-fleet-maintenance', 'standard', '29.00', 0, '0.00', 'monthly', '["Vehicle Inspections", "Service Scheduling", "Defect Tracking"]')
ON CONFLICT DO NOTHING;

-- Nexum Core tiers
INSERT INTO "plans" ("name", "product_id", "module_id", "tier", "base_price", "included_users", "per_user_price", "billing_interval", "features")
VALUES
  ('Nexum Starter', 'nexum', 'nexum-core', 'starter', '79.00', 5, '8.00', 'monthly', '["Jobs", "Business Entities", "Scheduling", "Dashboard"]'),
  ('Nexum Professional', 'nexum', 'nexum-core', 'professional', '179.00', 15, '6.00', 'monthly', '["All Starter features", "Advanced Scheduling", "Reporting"]')
ON CONFLICT DO NOTHING;

-- Nexum optional modules (flat add-ons, no user count — use Core allocation)
INSERT INTO "plans" ("name", "product_id", "module_id", "tier", "base_price", "included_users", "per_user_price", "billing_interval", "features")
VALUES
  ('Invoicing', 'nexum', 'nexum-invoicing', 'standard', '29.00', 0, '0.00', 'monthly', '["Invoice Generation", "Payment Tracking"]'),
  ('RCTI', 'nexum', 'nexum-rcti', 'standard', '19.00', 0, '0.00', 'monthly', '["Recipient Created Tax Invoices"]'),
  ('Xero Integration', 'nexum', 'nexum-xero', 'standard', '19.00', 0, '0.00', 'monthly', '["Xero Sync", "Chart of Accounts Mapping"]'),
  ('Compliance', 'nexum', 'nexum-compliance', 'standard', '29.00', 0, '0.00', 'monthly', '["SafeSpec Integration", "Compliance Dashboard"]'),
  ('SMS Messaging', 'nexum', 'nexum-sms', 'standard', '19.00', 0, '0.00', 'monthly', '["SMS Notifications", "Bulk Messaging"]'),
  ('Docket Processing', 'nexum', 'nexum-dockets', 'standard', '19.00', 0, '0.00', 'monthly', '["Digital Dockets", "Photo Capture"]'),
  ('Materials Management', 'nexum', 'nexum-materials', 'standard', '19.00', 0, '0.00', 'monthly', '["Material Tracking", "Stockpile Management"]'),
  ('Map Planning', 'nexum', 'nexum-map-planning', 'standard', '19.00', 0, '0.00', 'monthly', '["Route Planning", "Geofencing"]'),
  ('AI Automation', 'nexum', 'nexum-ai', 'standard', '29.00', 0, '0.00', 'monthly', '["Smart Scheduling", "Predictive Analytics"]'),
  ('Reporting & Analytics', 'nexum', 'nexum-reporting', 'standard', '19.00', 0, '0.00', 'monthly', '["Custom Reports", "Data Export"]'),
  ('Portal', 'nexum', 'nexum-portal', 'standard', '29.00', 0, '0.00', 'monthly', '["Customer Portal", "Self-Service Booking"]')
ON CONFLICT DO NOTHING;
