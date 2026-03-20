import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";

/**
 * Build the Fastify application instance.
 * Registers all plugins, middleware, and routes.
 */
export function buildApp(): ReturnType<typeof Fastify> {
  const isDev = config.nodeEnv === "development";

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: isDev
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    },
    disableRequestLogging: isDev,
  });

  // Dev: single-line request log for errors only
  if (isDev) {
    app.addHook("onResponse", (request, reply, done) => {
      const status = reply.statusCode;
      if (status >= 400) {
        app.log.warn(
          `${request.method} ${request.url} → ${status} (${reply.elapsedTime.toFixed(0)}ms)`,
        );
      }
      done();
    });
  }

  // ── Plugins ──

  void app.register(cors, {
    origin: [config.frontendUrl, config.productUrls.nexum, config.productUrls.safespec],
    credentials: true,
  });

  // TODO: Phase 2 — Register @fastify/swagger + @scalar/api-reference
  // TODO: Phase 3 — Register Better Auth routes

  // ── Routes ──

  // Health check (unauthenticated)
  void app.register(healthRoutes);

  // API v1 routes
  void app.register(
    async (api) => {
      api.get("/status", async () => ({
        success: true,
        data: { version: "0.0.0", environment: config.nodeEnv },
      }));
    },
    { prefix: "/api/v1" },
  );

  return app;
}
