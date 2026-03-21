import { config } from "./config.js";
import { buildApp } from "./app.js";
import { startOrphanCleanupJob } from "./jobs/cleanup-orphan-tenants.js";

const app = buildApp();

let stopCleanupJob: (() => void) | undefined;

try {
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
