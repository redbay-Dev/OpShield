import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { platformAdmins } from "../db/schema/tenants.js";
import { getSession } from "../middleware/auth.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me/admin-status", async (request, reply) => {
    const session = await getSession(request);

    if (!session) {
      void reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const [admin] = await db
      .select({ userId: platformAdmins.userId, role: platformAdmins.role })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, session.user.id))
      .limit(1);

    return {
      success: true,
      data: {
        isPlatformAdmin: Boolean(admin),
        role: admin?.role ?? null,
      },
    };
  });
}
