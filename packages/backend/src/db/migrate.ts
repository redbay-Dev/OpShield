import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, closeDbConnections } from "./client.js";

async function runMigrations(): Promise<void> {
  console.warn("Running OpShield migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.warn("Migrations complete.");
  await closeDbConnections();
}

void runMigrations();
