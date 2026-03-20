import { z } from "zod/v4";

/** Single module entitlement */
export const moduleEntitlementSchema = z.object({
  productId: z.string(),
  moduleId: z.string(),
  status: z.enum(["active", "trial", "suspended", "cancelled"]),
  maxUsers: z.number().int().positive(),
  currentUsers: z.number().int().min(0),
});

export type ModuleEntitlement = z.infer<typeof moduleEntitlementSchema>;

/** Full entitlements response from OpShield */
export const entitlementsResponseSchema = z.object({
  tenantId: z.string().uuid(),
  tenantStatus: z.enum(["onboarding", "active", "suspended", "cancelled"]),
  modules: z.array(moduleEntitlementSchema),
});

export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;
