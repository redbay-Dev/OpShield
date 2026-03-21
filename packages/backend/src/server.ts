import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { platformAdmins } from "./db/schema/tenants.js";
import { user } from "./db/schema/auth.js";
import { startOrphanCleanupJob } from "./jobs/cleanup-orphan-tenants.js";

/**
 * On a fresh install with no admins, promote the sole existing user to super_admin.
 * Only runs when: zero admins AND exactly one user in the system.
 * Once any admin exists or there are multiple users, this is a permanent no-op.
 */
async function promoteFirstUser(log: { info: (msg: string) => void }): Promise<void> {
  const adminRows = await db.select({ id: platformAdmins.id }).from(platformAdmins).limit(1);
  if (adminRows.length > 0) return;

  const userRows = await db.select({ id: user.id, email: user.email }).from(user);
  if (userRows.length !== 1) return;

  const firstUser = userRows[0];
  if (!firstUser) return;

  await db.insert(platformAdmins).values({
    userId: firstUser.id,
    role: "super_admin",
  });

  log.info(`First user (${firstUser.email}) promoted to super_admin.`);
}

const app = buildApp();

let stopCleanupJob: (() => void) | undefined;

try {
  app.log.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  app.log.info("Migrations complete.");

  await promoteFirstUser(app.log);

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
