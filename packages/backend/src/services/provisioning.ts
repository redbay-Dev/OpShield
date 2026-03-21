import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  tenants,
  tenantModules,
  tenantProvisioning,
  auditLog,
} from "../db/schema/tenants.js";
import { sendProvisioningWebhook } from "./webhook.js";
import { sendProvisioningFailedEmail } from "./email.js";
import { config } from "../config.js";

type ProductId = "nexum" | "safespec";

interface OwnerInfo {
  ownerUserId?: string;
  ownerEmail?: string;
  ownerName?: string;
}

interface ProvisionResult {
  productId: string;
  status: string;
  error: string | null;
}

/**
 * Provision a tenant by dispatching `tenant.created` webhooks to each product
 * that has modules assigned. Upserts provisioning rows and tracks status.
 */
export async function provisionTenant(
  tenantId: string,
  ownerInfo?: OwnerInfo,
): Promise<ProvisionResult[]> {
  // Get tenant details
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Get modules grouped by product
  const modules = await db
    .select()
    .from(tenantModules)
    .where(eq(tenantModules.tenantId, tenantId));

  const productModules = new Map<ProductId, string[]>();
  for (const mod of modules) {
    const pid = mod.productId as ProductId;
    const existing = productModules.get(pid) ?? [];
    existing.push(mod.moduleId);
    productModules.set(pid, existing);
  }

  if (productModules.size === 0) {
    return [];
  }

  const results: ProvisionResult[] = [];

  for (const [productId, moduleIds] of productModules) {
    // Upsert provisioning row
    const [existing] = await db
      .select()
      .from(tenantProvisioning)
      .where(
        and(
          eq(tenantProvisioning.tenantId, tenantId),
          eq(tenantProvisioning.productId, productId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(tenantProvisioning)
        .set({
          status: "dispatched",
          attempts: existing.attempts + 1,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(tenantProvisioning.id, existing.id));
    } else {
      await db.insert(tenantProvisioning).values({
        tenantId,
        productId,
        status: "dispatched",
        attempts: 1,
      });
    }

    // Dispatch webhook
    const webhookResult = await sendProvisioningWebhook(productId, tenantId, {
      name: tenant.name,
      plan: tenant.status,
      modules: moduleIds,
      ownerUserId: ownerInfo?.ownerUserId,
      ownerEmail: ownerInfo?.ownerEmail,
      ownerName: ownerInfo?.ownerName,
    });

    // If webhook delivery itself failed, mark as failed immediately
    if (webhookResult.error) {
      await db
        .update(tenantProvisioning)
        .set({
          status: "failed",
          lastError: webhookResult.error,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenantProvisioning.tenantId, tenantId),
            eq(tenantProvisioning.productId, productId),
          ),
        );

      results.push({ productId, status: "failed", error: webhookResult.error });
    } else {
      results.push({ productId, status: "dispatched", error: null });
    }
  }

  return results;
}

/**
 * Retry provisioning for a specific product that previously failed.
 */
export async function retryProvisioning(
  tenantId: string,
  productId: ProductId,
): Promise<ProvisionResult> {
  const [provRow] = await db
    .select()
    .from(tenantProvisioning)
    .where(
      and(
        eq(tenantProvisioning.tenantId, tenantId),
        eq(tenantProvisioning.productId, productId),
      ),
    )
    .limit(1);

  if (!provRow) {
    throw new Error(`No provisioning record found for product "${productId}"`);
  }

  if (provRow.status === "success") {
    return { productId, status: "success", error: null };
  }

  // Get tenant and modules
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const modules = await db
    .select({ moduleId: tenantModules.moduleId })
    .from(tenantModules)
    .where(
      and(
        eq(tenantModules.tenantId, tenantId),
        eq(tenantModules.productId, productId),
      ),
    );

  const moduleIds = modules.map((m) => m.moduleId);

  // Update status to dispatched
  await db
    .update(tenantProvisioning)
    .set({
      status: "dispatched",
      attempts: provRow.attempts + 1,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(tenantProvisioning.id, provRow.id));

  // Dispatch webhook
  const webhookResult = await sendProvisioningWebhook(productId, tenantId, {
    name: tenant.name,
    plan: tenant.status,
    modules: moduleIds,
  });

  if (webhookResult.error) {
    await db
      .update(tenantProvisioning)
      .set({
        status: "failed",
        lastError: webhookResult.error,
        updatedAt: new Date(),
      })
      .where(eq(tenantProvisioning.id, provRow.id));

    return { productId, status: "failed", error: webhookResult.error };
  }

  return { productId, status: "dispatched", error: null };
}

/**
 * Get provisioning status for all products of a tenant.
 */
export async function getProvisioningStatus(
  tenantId: string,
): Promise<Array<typeof tenantProvisioning.$inferSelect>> {
  return db
    .select()
    .from(tenantProvisioning)
    .where(eq(tenantProvisioning.tenantId, tenantId));
}

/**
 * Handle a provisioning callback from a product backend.
 * Updates provisioning status and logs to audit.
 */
export async function handleProvisioningCallback(
  tenantId: string,
  productId: ProductId,
  success: boolean,
  error?: string,
  actorId?: string,
): Promise<void> {
  const [provRow] = await db
    .select()
    .from(tenantProvisioning)
    .where(
      and(
        eq(tenantProvisioning.tenantId, tenantId),
        eq(tenantProvisioning.productId, productId),
      ),
    )
    .limit(1);

  if (!provRow) {
    throw new Error(`No provisioning record found for product "${productId}"`);
  }

  await db
    .update(tenantProvisioning)
    .set({
      status: success ? "success" : "failed",
      lastError: success ? null : (error ?? "Unknown error"),
      provisionedAt: success ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tenantProvisioning.id, provRow.id));

  // Audit log
  await db.insert(auditLog).values({
    actorId: actorId ?? `service:${productId}`,
    actorType: "service",
    action: success ? "provisioning.success" : "provisioning.failed",
    resourceType: "tenant",
    resourceId: tenantId,
    metadata: { productId, error: error ?? null },
  });

  // Send provisioning failed email to admin
  if (!success) {
    const [tenant] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    void sendProvisioningFailedEmail({
      to: config.smtp.from,
      tenantName: tenant?.name ?? tenantId,
      productId,
      error: error ?? "Unknown error",
      adminUrl: `${config.frontendUrl}/admin/tenants/${tenantId}`,
    }).catch(() => { /* non-blocking */ });
  }
}
