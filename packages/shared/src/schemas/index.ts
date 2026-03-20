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

/** Module entitlement response schema */
export const moduleEntitlementSchema = z.object({
  productId: z.string(),
  moduleId: z.string(),
  status: z.string(),
  maxUsers: z.number().int().positive(),
  currentUsers: z.number().int().min(0),
});

export type ModuleEntitlement = z.infer<typeof moduleEntitlementSchema>;

/** Entitlements response from OpShield to products */
export const entitlementsResponseSchema = z.object({
  tenantId: z.string().uuid(),
  tenantStatus: z.string(),
  modules: z.array(moduleEntitlementSchema),
});

export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;
