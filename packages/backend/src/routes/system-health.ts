import type { FastifyInstance } from "fastify";
import { requirePlatformAdmin } from "../middleware/require-platform-admin.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

interface ServiceHealth {
  name: string;
  status: "ok" | "unreachable" | "error";
  responseTimeMs: number;
  details?: Record<string, unknown>;
}

async function checkProductHealth(
  name: string,
  url: string,
): Promise<ServiceHealth> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const elapsed = Date.now() - start;

    if (!response.ok) {
      return { name, status: "error", responseTimeMs: elapsed, details: { httpStatus: response.status } };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return { name, status: "ok", responseTimeMs: elapsed, details: data };
  } catch {
    return { name, status: "unreachable", responseTimeMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { name: "PostgreSQL", status: "ok", responseTimeMs: Date.now() - start };
  } catch {
    return { name: "PostgreSQL", status: "error", responseTimeMs: Date.now() - start };
  }
}

export async function systemHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/system-health",
    { preHandler: [requirePlatformAdmin] },
    async () => {
      const [opshield, safespec, nexum, database] = await Promise.all([
        checkProductHealth("OpShield API", `http://localhost:${config.api.port}/health`),
        checkProductHealth("SafeSpec API", "http://localhost:3001/health"),
        checkProductHealth("Nexum API", "http://localhost:3002/health"),
        checkDatabase(),
      ]);

      return {
        success: true,
        data: {
          services: [opshield, safespec, nexum, database],
          checkedAt: new Date().toISOString(),
        },
      };
    },
  );
}
