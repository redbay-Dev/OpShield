import type { FastifyRequest } from "fastify";
import { auth } from "../auth.js";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Extract the authenticated session from a Fastify request.
 * Uses Better Auth's session API to verify the cookie/token.
 *
 * Returns the session object if authenticated, null otherwise.
 */
export async function getSession(request: FastifyRequest): Promise<SessionResult> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.append(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const session = await auth.api.getSession({
    headers,
  });

  return session;
}
