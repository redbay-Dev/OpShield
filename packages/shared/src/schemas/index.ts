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

/** Path params for module routes */
export const moduleIdParamSchema = z.object({
  tenantId: z.string().uuid(),
  moduleId: z.string().min(1),
});
