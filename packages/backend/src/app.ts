import type { FastifyReply } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { config } from "./config.js";
import { auth } from "./auth.js";
import { healthRoutes } from "./routes/health.js";
import { tenantRoutes } from "./routes/tenants.js";
import { entitlementRoutes } from "./routes/entitlements.js";
import { moduleRoutes } from "./routes/modules.js";
import { meRoutes } from "./routes/me.js";
import { serviceKeyRoutes } from "./routes/service-keys.js";

const TRUSTED_ORIGINS = new Set([
  config.auth.url,
  config.frontendUrl,
  config.productUrls.nexum,
  config.productUrls.safespec,
]);

/**
 * Validate a redirect location against trusted origins.
 * Returns a safe URL built from allowlisted origin + parsed path, or null.
 */
function validateRedirectLocation(raw: string): string | null {
  // Relative paths are safe — but reject protocol-relative URLs
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  // Find the matching trusted origin
  for (const trustedOrigin of TRUSTED_ORIGINS) {
    let trustedParsed: URL;
    try {
      trustedParsed = new URL(trustedOrigin);
    } catch {
      continue;
    }

    if (
      parsed.protocol === trustedParsed.protocol &&
      parsed.host === trustedParsed.host
    ) {
      // Rebuild entirely from the known-good origin + safe-encoded path components
      const safePath = new URL(parsed.pathname + parsed.search + parsed.hash, trustedOrigin);
      return safePath.href;
    }
  }

  return null;
}

/**
 * Convert a Fastify request into a Web Request, forward to Better Auth,
 * and return the Web Response.
 */
async function handleAuthRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<Response> {
  const url = new URL(path, config.auth.url);
  const webRequest = new Request(url, {
    method,
    headers: new Headers(headers),
    body: method !== "GET" && method !== "HEAD"
      ? JSON.stringify(body)
      : undefined,
  });
  return auth.handler(webRequest);
}

/** Safe header names to forward from Better Auth responses */
const SAFE_AUTH_HEADERS = new Set([
  "content-type",
  "set-cookie",
  "cache-control",
]);

/**
 * Forward a Better Auth Web Response back through a Fastify reply.
 * Hijacks the reply to write directly to the Node.js socket, bypassing
 * Fastify's response API. Redirect locations are validated against
 * TRUSTED_ORIGINS allowlist before forwarding.
 */
async function sendAuthResponse(
  response: Response,
  reply: FastifyReply,
): Promise<void> {
  reply.hijack();
  const socket = reply.raw;

  // Collect validated headers
  const outHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (SAFE_AUTH_HEADERS.has(key)) {
      outHeaders[key] = value;
    }
  });

  // Validate redirect location against allowlist
  const locationValue = response.headers.get("location");
  if (locationValue) {
    const safe = validateRedirectLocation(locationValue);
    if (safe) {
      outHeaders["location"] = safe;
    }
  }

  const body = await response.text();
  socket.writeHead(response.status, outHeaders);
  socket.end(body);
}

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

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

  void app.register(helmet, {
    contentSecurityPolicy: isDev ? false : undefined,
  });

  void app.register(cors, {
    origin: [config.frontendUrl, config.productUrls.nexum, config.productUrls.safespec],
    credentials: true,
  });

  // ── Better Auth catch-all ──
  app.all("/api/auth/*", async (request, reply) => {
    const response = await handleAuthRequest(request.url, request.method, request.headers as Record<string, string>, request.body);
    return sendAuthResponse(response, reply);
  });

  // ── JWKS endpoint ──
  app.get("/.well-known/jwks.json", async (request, reply) => {
    const response = await handleAuthRequest("/api/auth/.well-known/jwks.json", "GET", request.headers as Record<string, string>);
    return sendAuthResponse(response, reply);
  });

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

      void api.register(meRoutes);
      void api.register(tenantRoutes);
      void api.register(entitlementRoutes);
      void api.register(moduleRoutes);
      void api.register(serviceKeyRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
