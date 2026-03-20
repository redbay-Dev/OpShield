import type {
  PRODUCTS,
  SAFESPEC_MODULES,
  NEXUM_MODULES,
  TENANT_STATUS,
  MODULE_STATUS,
  SUBSCRIPTION_STATUS,
  PLAN_TIERS,
} from "../constants/index.js";

export type Product = (typeof PRODUCTS)[keyof typeof PRODUCTS];
export type SafeSpecModule =
  (typeof SAFESPEC_MODULES)[keyof typeof SAFESPEC_MODULES];
export type NexumModule = (typeof NEXUM_MODULES)[keyof typeof NEXUM_MODULES];
export type ModuleId = SafeSpecModule | NexumModule;
export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];
export type ModuleStatus = (typeof MODULE_STATUS)[keyof typeof MODULE_STATUS];
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
export type PlanTier = (typeof PLAN_TIERS)[keyof typeof PLAN_TIERS];
