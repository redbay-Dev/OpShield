-- Update platform_admins role column to use new 3-tier roles
-- Existing "admin" role maps to "super_admin"
UPDATE "platform_admins" SET "role" = 'super_admin' WHERE "role" = 'admin';
ALTER TABLE "platform_admins" ALTER COLUMN "role" SET DEFAULT 'viewer';
