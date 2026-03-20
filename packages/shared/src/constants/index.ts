/** Products in the Redbay suite */
export const PRODUCTS = {
  NEXUM: "nexum",
  SAFESPEC: "safespec",
} as const;

/** SafeSpec modules */
export const SAFESPEC_MODULES = {
  WHS: "safespec-whs",
  HVA: "safespec-hva",
  FLEET_MAINTENANCE: "safespec-fleet-maintenance",
} as const;

/** Nexum modules */
export const NEXUM_MODULES = {
  CORE: "nexum-core",
  INVOICING: "nexum-invoicing",
  RCTI: "nexum-rcti",
  XERO: "nexum-xero",
  COMPLIANCE: "nexum-compliance",
  SMS: "nexum-sms",
  DOCKETS: "nexum-dockets",
  MATERIALS: "nexum-materials",
  MAP_PLANNING: "nexum-map-planning",
  AI: "nexum-ai",
  REPORTING: "nexum-reporting",
  PORTAL: "nexum-portal",
} as const;

/** Tenant statuses */
export const TENANT_STATUS = {
  ONBOARDING: "onboarding",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
} as const;

/** Module statuses */
export const MODULE_STATUS = {
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
} as const;

/** Subscription statuses (mirroring Stripe) */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  TRIALING: "trialing",
  INCOMPLETE: "incomplete",
  UNPAID: "unpaid",
} as const;

/** Plan tiers */
export const PLAN_TIERS = {
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;

/** Billing intervals */
export const BILLING_INTERVALS = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
} as const;

/** Stripe coupon IDs for bundle discounts */
export const STRIPE_COUPONS = {
  BUNDLE_10_PERCENT: "bundle_10_percent",
  BUNDLE_15_PERCENT: "bundle_15_percent",
} as const;
