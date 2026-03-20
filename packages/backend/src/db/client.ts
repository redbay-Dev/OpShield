import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema/index.js";

/**
 * Postgres connection for the OpShield database.
 * Flat schema — no multi-tenancy, no tenant-scoped connections.
 */
const pgClient = postgres(config.database.url, { max: 10 });

export const db = drizzle(pgClient, { schema });

/**
 * Close database connections (for graceful shutdown).
 */
export async function closeDbConnections(): Promise<void> {
  await pgClient.end();
}
