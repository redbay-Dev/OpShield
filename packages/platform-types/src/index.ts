/**
 * @redbay/platform-types
 *
 * Shared contract types consumed by SafeSpec and Nexum.
 * Contains Zod schemas for API requests/responses and webhook payloads.
 *
 * Products import this package to validate responses from OpShield
 * and type webhook payloads.
 */
export {
  entitlementsResponseSchema,
  moduleEntitlementSchema,
  type EntitlementsResponse,
  type ModuleEntitlement,
} from "./entitlements.js";

export {
  webhookPayloadSchema,
  type WebhookPayload,
  type WebhookEvent,
} from "./webhooks.js";
