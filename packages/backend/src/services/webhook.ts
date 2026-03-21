import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { webhookDeliveries } from "../db/schema/billing.js";
import { tenantModules } from "../db/schema/tenants.js";

/** Webhook event types that OpShield dispatches to products */
type WebhookEvent =
  | "tenant.created"
  | "module.activated"
  | "module.suspended"
  | "module.cancelled"
  | "tenant.suspended"
  | "tenant.cancelled"
  | "tenant.reactivated"
  | "user_count.updated"
  | "session.revoked";

type ProductId = "nexum" | "safespec";

interface WebhookConfig {
  url: string;
  secret: string;
}

function getWebhookConfig(productId: ProductId): WebhookConfig {
  return config.webhooks[productId];
}

/**
 * Create HMAC-SHA256 signature for a webhook payload.
 * Format: `t=<timestamp>,v1=<hmac>` (similar to Stripe's scheme).
 */
export function signPayload(body: string, secret: string, timestamp: number): string {
  const signedContent = `${timestamp}.${body}`;
  const hmac = createHmac("sha256", secret).update(signedContent).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * Send a signed webhook to a specific product and log the delivery.
 */
async function sendWebhook(
  productId: ProductId,
  eventType: WebhookEvent,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const webhookConfig = getWebhookConfig(productId);

  // Skip if no secret configured (dev mode where products aren't running)
  if (!webhookConfig.secret || !webhookConfig.url) {
    return;
  }

  const payload = {
    id: randomUUID(),
    event: eventType,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(body, webhookConfig.secret, timestamp);

  let httpStatus: number | null = null;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpShield-Signature": signature,
        "X-OpShield-Timestamp": String(timestamp),
        "X-OpShield-Event": eventType,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = response.status;

    if (!response.ok) {
      error = `HTTP ${response.status}: ${await response.text().catch(() => "unknown")}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  // Log delivery (fire-and-forget — don't let logging failure break the flow)
  try {
    await db.insert(webhookDeliveries).values({
      productId,
      eventType,
      tenantId,
      httpStatus,
      error,
      payload: payload as unknown as Record<string, unknown>,
    });
  } catch {
    // Delivery logging failure is non-critical
  }
}

/** Result from an awaitable provisioning webhook send */
export interface ProvisioningWebhookResult {
  deliveryId: string;
  httpStatus: number | null;
  error: string | null;
}

/**
 * Send a provisioning webhook and return the result (awaitable, not fire-and-forget).
 * Used by the provisioning service to track delivery status.
 */
export async function sendProvisioningWebhook(
  productId: ProductId,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<ProvisioningWebhookResult> {
  const webhookConfig = getWebhookConfig(productId);
  const deliveryId = randomUUID();

  if (!webhookConfig.secret || !webhookConfig.url) {
    return { deliveryId, httpStatus: null, error: "Webhook not configured for product" };
  }

  const payload = {
    id: deliveryId,
    event: "tenant.created" as const,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(body, webhookConfig.secret, timestamp);

  let httpStatus: number | null = null;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpShield-Signature": signature,
        "X-OpShield-Timestamp": String(timestamp),
        "X-OpShield-Event": "tenant.created",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = response.status;

    if (!response.ok) {
      error = `HTTP ${response.status}: ${await response.text().catch(() => "unknown")}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  // Log delivery
  try {
    await db.insert(webhookDeliveries).values({
      productId,
      eventType: "tenant.created",
      tenantId,
      httpStatus,
      error,
      payload: payload as unknown as Record<string, unknown>,
    });
  } catch {
    // Delivery logging failure is non-critical
  }

  return { deliveryId, httpStatus, error };
}

/**
 * Dispatch a webhook to all products that have modules for the given tenant.
 * Fire-and-forget — errors are logged to DB but never thrown to callers.
 */
export function dispatchWebhook(
  event: WebhookEvent,
  tenantId: string,
  data: Record<string, unknown>,
): void {
  void (async () => {
    try {
      // Query which products this tenant has modules with
      const modules = await db
        .select({ productId: tenantModules.productId })
        .from(tenantModules)
        .where(eq(tenantModules.tenantId, tenantId));

      const productIds = [...new Set(modules.map((m) => m.productId))] as ProductId[];

      await Promise.allSettled(
        productIds.map((productId) => sendWebhook(productId, event, tenantId, data)),
      );
    } catch {
      // Silent failure in v1
    }
  })();
}

/**
 * Dispatch a webhook to a specific known product.
 * Fire-and-forget — used when the target product is already known (e.g., usage reporting).
 */
/**
 * Dispatch session.revoked webhook to ALL products (not tenant-scoped).
 * Used for global logout.
 */
export function dispatchSessionRevokedWebhook(
  userId: string,
): void {
  const products: ProductId[] = ["nexum", "safespec"];
  void (async () => {
    try {
      await Promise.allSettled(
        products.map((productId) =>
          sendWebhook(productId, "session.revoked", "global", { userId, revokedAt: new Date().toISOString() }),
        ),
      );
    } catch {
      // Silent failure in v1
    }
  })();
}

export function dispatchWebhookToProduct(
  productId: ProductId,
  event: WebhookEvent,
  tenantId: string,
  data: Record<string, unknown>,
): void {
  void sendWebhook(productId, event, tenantId, data).catch(() => {
    // Silent failure in v1
  });
}
