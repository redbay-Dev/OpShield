import { z } from "zod/v4";

/** Events that OpShield sends to products */
export const webhookEventSchema = z.enum([
  "module.activated",
  "module.suspended",
  "module.cancelled",
  "tenant.suspended",
  "tenant.cancelled",
  "tenant.reactivated",
  "user_count.updated",
]);

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

/** Webhook payload sent by OpShield (HMAC-signed) */
export const webhookPayloadSchema = z.object({
  id: z.string().uuid(),
  event: webhookEventSchema,
  tenantId: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
