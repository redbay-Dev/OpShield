import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "./auth.js";

/** Session user attached to authenticated requests */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Guard that requires a valid authenticated session (no admin check).
 * Use as a Fastify preHandler hook on routes accessible to any logged-in user.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const session = await getSession(request);

  if (!session) {
    void reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  // Attach user to request for downstream use
  (request as FastifyRequest & { authUser: AuthenticatedUser }).authUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
