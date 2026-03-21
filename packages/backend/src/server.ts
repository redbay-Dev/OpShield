import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { auth } from "./auth.js";
import { platformAdmins } from "./db/schema/tenants.js";
import { user } from "./db/schema/auth.js";
import { startOrphanCleanupJob } from "./jobs/cleanup-orphan-tenants.js";

const DEFAULT_ADMIN_EMAIL = "admin@nexum.net.au";
const DEFAULT_ADMIN_PASSWORD = "admin";
const DEFAULT_ADMIN_NAME = "Platform Admin";

/**
 * Bootstrap the default super_admin account on fresh installs.
 *
 * Runs on every startup. If a valid super_admin already exists, this is a no-op.
 *
 * On a fresh database (zero platform_admins), this:
 * 1. Creates a user account via Better Auth's API (proper password hashing)
 * 2. Marks it must_change_password = true
 * 3. Inserts a platform_admins row with role = super_admin
 *
 * The admin must change their password and name on first login.
 * Credentials are logged to the console on creation so the deployer can see them.
 */
async function bootstrapSuperAdmin(log: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}): Promise<void> {
  // Clean up orphaned admin rows (user_id pointing to deleted users)
  const allAdminRows = await db
    .select({ id: platformAdmins.id, userId: platformAdmins.userId })
    .from(platformAdmins);

  for (const adminRow of allAdminRows) {
    const [linkedUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, adminRow.userId))
      .limit(1);

    if (!linkedUser) {
      await db.delete(platformAdmins).where(eq(platformAdmins.id, adminRow.id));
      log.warn(
        `Removed orphaned platform_admin row (user_id=${adminRow.userId} no longer exists).`,
      );
    }
  }

  // Check if any valid super_admin exists
  const [existingAdmin] = await db
    .select({
      id: platformAdmins.id,
      userId: platformAdmins.userId,
    })
    .from(platformAdmins)
    .limit(1);

  if (existingAdmin) {
    // Admin exists — check if they still need to change password (never completed setup).
    // If so, remove and re-create so the current default password takes effect.
    const [adminUser] = await db
      .select({
        id: user.id,
        mustChangePassword: user.mustChangePassword,
      })
      .from(user)
      .where(eq(user.id, existingAdmin.userId))
      .limit(1);

    if (adminUser?.mustChangePassword) {
      log.info("Bootstrap admin never completed setup — re-creating with current default password...");
      // Cascade deletes handle account/session cleanup via FK onDelete
      await db.delete(platformAdmins).where(eq(platformAdmins.id, existingAdmin.id));
      await db.delete(user).where(eq(user.id, adminUser.id));
      // Fall through to re-create below
    } else {
      return;
    }
  }

  // No admins exist — bootstrap the default account
  log.info("No platform admins found. Creating default super_admin account...");

  // Check if the default email is already taken (e.g., from a previous partial bootstrap)
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEFAULT_ADMIN_EMAIL))
    .limit(1);

  let adminUserId: string;

  if (existingUser) {
    // User exists but wasn't promoted — promote them
    adminUserId = existingUser.id;
    log.info(`User ${DEFAULT_ADMIN_EMAIL} already exists, promoting to super_admin.`);
  } else {
    // Create the account via Better Auth API (handles password hashing correctly)
    const result = await auth.api.signUpEmail({
      body: {
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        name: DEFAULT_ADMIN_NAME,
      },
    });

    if (!result.user) {
      log.warn("Failed to create default admin account.");
      return;
    }

    adminUserId = result.user.id;

    // Mark as must_change_password
    await db
      .update(user)
      .set({ mustChangePassword: true })
      .where(eq(user.id, adminUserId));
  }

  // Insert platform admin record
  await db.insert(platformAdmins).values({
    userId: adminUserId,
    role: "super_admin",
  });

  log.info("═══════════════════════════════════════════════════════");
  log.info("  DEFAULT SUPER ADMIN ACCOUNT CREATED");
  log.info(`  Email:    ${DEFAULT_ADMIN_EMAIL}`);
  log.info(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
  log.info("  You MUST change these credentials on first login.");
  log.info("═══════════════════════════════════════════════════════");
}

const app = buildApp();

let stopCleanupJob: (() => void) | undefined;

try {
  app.log.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  app.log.info("Migrations complete.");

  await bootstrapSuperAdmin(app.log);

  await app.listen({ port: config.api.port, host: config.api.host });
  stopCleanupJob = startOrphanCleanupJob(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

async function shutdown(): Promise<void> {
  app.log.info("Shutting down...");
  stopCleanupJob?.();
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
