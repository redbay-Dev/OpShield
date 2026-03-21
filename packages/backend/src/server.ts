import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { startOrphanCleanupJob } from "./jobs/cleanup-orphan-tenants.js";

const app = buildApp();

let stopCleanupJob: (() => void) | undefined;

try {
  // Run pending migrations before accepting requests
  app.log.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  app.log.info("Migrations complete.");

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
