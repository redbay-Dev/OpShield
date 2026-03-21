import { z } from "zod/v4";

/** Tenant creation schema */
export const createTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  billingEmail: z.email(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** Plan info attached to module entitlements */
export const modulePlanSchema = z.object({
  tier: z.string(),
  includedUsers: z.number().int(),
  basePrice: z.string(),
  perUserPrice: z.string(),
});

export type ModulePlan = z.infer<typeof modulePlanSchema>;

/** Module entitlement response schema */
export const moduleEntitlementSchema = z.object({
  productId: z.string(),
  moduleId: z.string(),
  status: z.string(),
  maxUsers: z.number().int().positive(),
  currentUsers: z.number().int().min(0),
  plan: modulePlanSchema.nullable().optional(),
});

export type ModuleEntitlement = z.infer<typeof moduleEntitlementSchema>;

/** Entitlements response from OpShield to products */
export const entitlementsResponseSchema = z.object({
  tenantId: z.string().uuid(),
  tenantStatus: z.string(),
  modules: z.array(moduleEntitlementSchema),
});

export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

/** Tenant update schema (all fields optional) */
export const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  billingEmail: z.email().optional(),
  status: z.enum(["onboarding", "active", "suspended", "cancelled"]).optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

/** Tenant response schema */
export const tenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  billingEmail: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TenantResponse = z.infer<typeof tenantResponseSchema>;

/** Query params for listing tenants */
export const tenantListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["onboarding", "active", "suspended", "cancelled"]).optional(),
  search: z.string().optional(),
});

export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;

/** Path param for tenant ID */
export const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid(),
});

export type TenantIdParam = z.infer<typeof tenantIdParamSchema>;

/** Add module to tenant */
export const addModuleSchema = z.object({
  productId: z.enum(["safespec", "nexum"]),
  moduleId: z.string().min(1).max(50),
  maxUsers: z.number().int().positive().default(5),
  status: z.enum(["active", "trial"]).default("active"),
});

export type AddModuleInput = z.infer<typeof addModuleSchema>;

/** Update module on tenant */
export const updateModuleSchema = z.object({
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  maxUsers: z.number().int().positive().optional(),
});

export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

/** Service API key creation schema */
export const createServiceKeySchema = z.object({
  productId: z.enum(["safespec", "nexum"]),
});

export type CreateServiceKeyInput = z.infer<typeof createServiceKeySchema>;

/** Service API key response schema (list view — no raw key) */
export const serviceKeyResponseSchema = z.object({
  id: z.string().uuid(),
  productId: z.string(),
  keyPrefix: z.string(),
  status: z.string(),
  createdBy: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type ServiceKeyResponse = z.infer<typeof serviceKeyResponseSchema>;

/** Path params for module routes */
export const moduleIdParamSchema = z.object({
  tenantId: z.string().uuid(),
  moduleId: z.string().min(1),
});

/** Create a subscription for a tenant */
export const createSubscriptionSchema = z.object({
  billingInterval: z.enum(["monthly", "annual"]),
  trialPeriodDays: z.number().int().min(1).max(90).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

/** Cancel a subscription */
export const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().default(true),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

/** Subscription item in response */
export const subscriptionItemResponseSchema = z.object({
  id: z.string().uuid(),
  stripeItemId: z.string().nullable(),
  planId: z.string().uuid(),
  moduleId: z.string(),
  productId: z.string(),
  quantity: z.number().int(),
});

export type SubscriptionItemResponse = z.infer<typeof subscriptionItemResponseSchema>;

/** Subscription response */
export const subscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  stripeSubscriptionId: z.string(),
  status: z.string(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  stripeCouponId: z.string().nullable(),
  items: z.array(subscriptionItemResponseSchema),
  createdAt: z.string(),
});

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

/** Provisioning status values */
export const provisioningStatusValues = [
  "pending",
  "dispatched",
  "success",
  "failed",
] as const;

/** Provisioning status response per product */
export const provisioningStatusSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  productId: z.string(),
  status: z.enum(provisioningStatusValues),
  attempts: z.number().int().min(0),
  lastError: z.string().nullable(),
  provisionedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProvisioningStatus = z.infer<typeof provisioningStatusSchema>;

/** Request body for triggering provisioning */
export const provisionTenantRequestSchema = z.object({
  ownerUserId: z.string().optional(),
  ownerEmail: z.email().optional(),
  ownerName: z.string().optional(),
});

export type ProvisionTenantRequest = z.infer<typeof provisionTenantRequestSchema>;

/** Callback from product backends confirming provisioning result */
export const provisioningCallbackSchema = z.object({
  productId: z.enum(["safespec", "nexum"]),
  success: z.boolean(),
  error: z.string().optional(),
});

export type ProvisioningCallbackInput = z.infer<typeof provisioningCallbackSchema>;

/** Retry provisioning for a specific product */
export const retryProvisioningSchema = z.object({
  productId: z.enum(["safespec", "nexum"]),
});

export type RetryProvisioningInput = z.infer<typeof retryProvisioningSchema>;

/** Usage report submitted by product backends */
export const usageReportSchema = z.object({
  tenantId: z.string().uuid(),
  productId: z.enum(["safespec", "nexum"]),
  moduleId: z.string().min(1).max(50),
  metric: z.literal("user_count"),
  value: z.number().int().min(0),
  breakdown: z.record(z.string(), z.unknown()).optional(),
});

export type UsageReportInput = z.infer<typeof usageReportSchema>;

/** Invoice response schema */
export const invoiceResponseSchema = z.object({
  id: z.string().uuid(),
  stripeInvoiceId: z.string(),
  status: z.string(),
  amountDue: z.number().int(),
  amountPaid: z.number().int(),
  currency: z.string(),
  invoiceUrl: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  createdAt: z.string(),
});

export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;

/** Query params for listing webhook deliveries */
export const webhookDeliveryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tenantId: z.string().uuid().optional(),
  productId: z.enum(["safespec", "nexum"]).optional(),
  eventType: z.string().optional(),
  status: z.enum(["success", "failed"]).optional(),
});

export type WebhookDeliveryQuery = z.infer<typeof webhookDeliveryQuerySchema>;

/** Webhook delivery response schema */
export const webhookDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  productId: z.string(),
  eventType: z.string(),
  tenantId: z.string().uuid(),
  httpStatus: z.number().int().nullable(),
  error: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type WebhookDeliveryResponse = z.infer<typeof webhookDeliveryResponseSchema>;

// ── Self-Service Sign-Up Schemas ──────────────────────────────────────

/** Module selection for sign-up checkout */
export const signupModuleSelectionSchema = z.object({
  productId: z.enum(["safespec", "nexum"]),
  moduleId: z.string().min(1).max(50),
  tier: z.string().min(1).max(50),
});

export type SignupModuleSelection = z.infer<typeof signupModuleSelectionSchema>;

/** Self-service checkout request */
export const signupCheckoutSchema = z.object({
  companyName: z.string().min(2).max(255),
  companySlug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  billingEmail: z.email(),
  billingInterval: z.enum(["monthly", "annual"]),
  modules: z.array(signupModuleSelectionSchema).min(1, "At least one module is required"),
});

export type SignupCheckoutInput = z.infer<typeof signupCheckoutSchema>;

/** Slug availability check */
export const checkSlugQuerySchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export type CheckSlugQuery = z.infer<typeof checkSlugQuerySchema>;

/** Public plan response (for pricing page) */
export const publicPlanResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  productId: z.string(),
  moduleId: z.string(),
  tier: z.string(),
  basePrice: z.string(),
  includedUsers: z.number().int(),
  perUserPrice: z.string(),
  billingInterval: z.string(),
  features: z.array(z.string()),
});

export type PublicPlanResponse = z.infer<typeof publicPlanResponseSchema>;

// ── Audit Log Schemas ───────────────────────────────────────────────

/** Query params for listing audit log entries */
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().optional(),
  resourceId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/** Audit log entry response */
export const auditLogResponseSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string(),
  actorType: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

// ── SSO Provider Schemas ────────────────────────────────────────────

/** Create/update SSO provider for a tenant */
export const upsertSsoProviderSchema = z.object({
  provider: z.literal("microsoft"),
  clientId: z.string().min(1).max(255),
  clientSecret: z.string().min(1),
  tenantIdAzure: z.string().min(1).max(255),
  enforced: z.boolean().default(false),
});

export type UpsertSsoProviderInput = z.infer<typeof upsertSsoProviderSchema>;

// ── Notification Preferences Schemas ──────────────────────────────────

/** Notification preferences response */
export const notificationPreferencesSchema = z.object({
  billingEmails: z.boolean(),
  supportEmails: z.boolean(),
  productUpdates: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

/** Update notification preferences */
export const updateNotificationPreferencesSchema = z.object({
  billingEmails: z.boolean().optional(),
  supportEmails: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

/** SSO provider response (client secret masked) */
export const ssoProviderResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: z.string(),
  clientId: z.string(),
  tenantIdAzure: z.string().nullable(),
  enforced: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SsoProviderResponse = z.infer<typeof ssoProviderResponseSchema>;
