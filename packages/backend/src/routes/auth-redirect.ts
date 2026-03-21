import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { getSession } from "../middleware/auth.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { tenantUsers } from "../db/schema/tenant-users.js";

const authorizeQuerySchema = z.object({
  product: z.enum(["safespec", "nexum"]),
});

/**
 * Auth authorize/redirect endpoint for cross-domain SSO.
 * Products redirect here; if user has a session, they get a JSON response
 * with user info and the allowlisted callback URL. The client performs the
 * redirect — avoiding server-side open redirect concerns.
 *
 * If no session, returns 401 so the caller can redirect to login.
 *
 * NOTE: Preparation endpoint for when products implement callback handlers.
 */
export async function authRedirectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/auth/authorize", async (request, reply) => {
    const queryResult = authorizeQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      void reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "product query param required (safespec or nexum)" },
      });
      return;
    }

    const { product } = queryResult.data;
    const session = await getSession(request);

    if (!session) {
      void reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          loginUrl: "/auth/login",
          product,
        },
      });
      return;
    }

    // Get tenant memberships for this user
    const memberships = await db
      .select({
        tenantId: tenantUsers.tenantId,
        role: tenantUsers.role,
      })
      .from(tenantUsers)
      .where(eq(tenantUsers.userId, session.user.id));

    // Allowlisted callback URLs — only "safespec" or "nexum" reach here (Zod enum)
    const callbackUrls: Record<string, string> = {
      nexum: `${config.productUrls.nexum}/auth/callback`,
      safespec: `${config.productUrls.safespec}/auth/callback`,
    };

    return {
      success: true,
      data: {
        callbackUrl: callbackUrls[product],
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        product,
        memberships: memberships.map((m) => ({
          tenantId: m.tenantId,
          role: m.role,
        })),
      },
    };
  });
}
