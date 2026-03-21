import { lt, eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, auditLog } from "../db/schema/tenants.js";
import { tenantModules } from "../db/schema/tenants.js";
import { tenantUsers } from "../db/schema/tenant-users.js";
import type { FastifyBaseLogger } from "fastify";

/**
 * Maximum age for onboarding tenants before cleanup.
 * Tenants stuck in "onboarding" for longer than this are considered abandoned.
 */
const ORPHAN_AGE_DAYS = 7;

/**
 * Interval between cleanup runs (6 hours in ms).
 */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Find and soft-delete tenants that have been in "onboarding" status
 * for more than ORPHAN_AGE_DAYS days — these are abandoned sign-ups
 * where the user started checkout but never completed payment.
 */
export async function cleanupOrphanTenants(
  logger: FastifyBaseLogger,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ORPHAN_AGE_DAYS);

  // Find orphans
  const orphans = await db
    .select({ id: tenants.id, slug: tenants.slug, createdAt: tenants.createdAt })
    .from(tenants)
    .where(
      and(
        eq(tenants.status, "onboarding"),
        lt(tenants.createdAt, cutoff),
        isNull(tenants.deletedAt),
      ),
    );

  if (orphans.length === 0) {
    return 0;
  }

  logger.info(`Found ${orphans.length} orphan tenant(s) to clean up`);

  for (const orphan of orphans) {
    // Soft-delete the tenant
    await db
      .update(tenants)
      .set({
        deletedAt: new Date(),
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, orphan.id));

    // Clean up related records
    await db
      .delete(tenantModules)
      .where(eq(tenantModules.tenantId, orphan.id));

    await db
      .delete(tenantUsers)
      .where(eq(tenantUsers.tenantId, orphan.id));

    // Audit log
    await db.insert(auditLog).values({
      actorId: "system",
      actorType: "system",
      action: "tenant.orphan_cleanup",
      resourceType: "tenant",
      resourceId: orphan.id,
      metadata: {
        slug: orphan.slug,
        createdAt: orphan.createdAt.toISOString(),
        reason: `Onboarding tenant abandoned for >${ORPHAN_AGE_DAYS} days`,
      },
    });

    logger.info(
      `Cleaned up orphan tenant: ${orphan.slug} (${orphan.id}), created ${orphan.createdAt.toISOString()}`,
    );
  }

  return orphans.length;
}

/**
 * Start the periodic orphan tenant cleanup job.
 * Returns a cleanup function to stop the interval.
 */
export function startOrphanCleanupJob(
  logger: FastifyBaseLogger,
): () => void {
  // Run once at startup
  void cleanupOrphanTenants(logger).catch((err: unknown) => {
    logger.error(err, "Orphan tenant cleanup failed");
  });

  // Then run periodically
  const interval = setInterval(() => {
    void cleanupOrphanTenants(logger).catch((err: unknown) => {
      logger.error(err, "Orphan tenant cleanup failed");
    });
  }, CLEANUP_INTERVAL_MS);

  return () => clearInterval(interval);
}
