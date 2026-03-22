import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSession } from "../middleware/auth.js";
import { auth } from "../auth.js";
import { config } from "../config.js";

/**
 * Allowed callback URL origins for SSO redirect.
 * Only product frontend origins (which proxy /api to their backends) are allowed.
 *
 * In dev:
 *   Nexum  → http://localhost:5171/api/v1/auth/callback → proxied to :3002
 *   SafeSpec → http://localhost:5172/api/v1/auth/callback → proxied to :3001
 */
const ALLOWED_CALLBACK_ORIGINS: ReadonlySet<string> = new Set(
  [config.productUrls.nexum, config.productUrls.safespec]
    .map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null),
);

/**
 * Validate a callback URL against allowed product origins.
 * Only allows URLs on known product origins with an auth callback path.
 * Returns the validated URL string or null if invalid.
 */
function validateCallbackUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  // Protocol must be http or https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  // Origin must be an allowed product origin
  if (!ALLOWED_CALLBACK_ORIGINS.has(parsed.origin)) {
    return null;
  }

  // Path must end with /auth/callback (the product's auth callback route)
  if (!parsed.pathname.endsWith("/auth/callback")) {
    return null;
  }

  // Rebuild from validated components to prevent any URL tricks
  const safe = new URL(parsed.pathname, parsed.origin);
  return safe.href;
}

/**
 * SSO redirect routes for cross-domain authentication.
 *
 * Flow:
 * 1. User visits a product (Nexum/SafeSpec), is unauthenticated
 * 2. Product redirects to OpShield: /auth/login?redirect=<product_callback_url>
 * 3. User authenticates on OpShield (login + 2FA)
 * 4. Frontend navigates to /api/auth/sso-redirect?callback=<product_callback_url>
 * 5. This endpoint validates session, validates callback, gets JWT, redirects with token
 * 6. Product receives token, validates via JWKS, creates local session
 */
export async function authRedirectRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/auth/sso-redirect?callback=<url>
   *
   * Requires an authenticated Better Auth session (cookie-based).
   * Validates the callback URL against allowed product origins.
   * Gets a JWT from Better Auth's JWT plugin.
   * Redirects (302) to the product callback with ?token=<JWT>.
   */
  app.get("/api/auth/sso-redirect", async (request: FastifyRequest, reply: FastifyReply) => {
    const { callback } = request.query as { callback?: string };

    if (!callback) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "callback query param required",
        },
      });
    }

    const validatedCallback = validateCallbackUrl(callback);
    if (!validatedCallback) {
      request.log.warn({ callback }, "SSO redirect rejected: invalid callback URL");
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_CALLBACK",
          message: "Callback URL is not an allowed product origin",
        },
      });
    }

    // Verify the user has an authenticated session
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    // Get a JWT from Better Auth's JWT plugin by forwarding the request
    // The token endpoint uses the session cookies to identify the user
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) {
        headers.append(key, Array.isArray(value) ? value.join(", ") : value);
      }
    }

    const tokenUrl = new URL("/api/auth/token", config.auth.url);
    const tokenRequest = new Request(tokenUrl.href, {
      method: "GET",
      headers,
    });

    const tokenResponse = await auth.handler(tokenRequest);

    if (!tokenResponse.ok) {
      request.log.error(
        { status: tokenResponse.status },
        "Failed to generate JWT from Better Auth token endpoint",
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: "TOKEN_ERROR",
          message: "Failed to generate authentication token",
        },
      });
    }

    const tokenData = (await tokenResponse.json()) as { token?: string };

    if (!tokenData.token) {
      request.log.error("Better Auth token endpoint returned no token");
      return reply.status(500).send({
        success: false,
        error: {
          code: "TOKEN_ERROR",
          message: "Authentication token was empty",
        },
      });
    }

    // Build the redirect URL with the JWT token
    const redirectUrl = new URL(validatedCallback);
    redirectUrl.searchParams.set("token", tokenData.token);

    request.log.info(
      { userId: session.user.id, callback: validatedCallback },
      "SSO redirect: issuing JWT and redirecting to product",
    );

    return reply.redirect(redirectUrl.href);
  });
}
