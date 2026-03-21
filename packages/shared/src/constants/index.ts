/** Products in the Nexum suite */
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

/** Platform admin roles */
export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  SUPPORT: "support",
  VIEWER: "viewer",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

/**
 * Role permission matrix.
 * super_admin: full access
 * support: read + create + modify (no delete, no destructive actions)
 * viewer: read-only
 */
export const ADMIN_ROLE_PERMISSIONS = {
  super_admin: { read: true, create: true, update: true, delete: true },
  support: { read: true, create: true, update: true, delete: false },
  viewer: { read: true, create: false, update: false, delete: false },
} as const;

/** Support ticket categories */
export const TICKET_CATEGORIES = {
  BUG_REPORT: "bug_report",
  FEATURE_REQUEST: "feature_request",
  BILLING: "billing",
  HOW_TO: "how_to",
  ACCOUNT: "account",
  OTHER: "other",
} as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[keyof typeof TICKET_CATEGORIES];

/** Support ticket priorities */
export const TICKET_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[keyof typeof TICKET_PRIORITIES];

/** Support ticket statuses */
export const TICKET_STATUSES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_ON_CUSTOMER: "waiting_on_customer",
  WAITING_ON_INTERNAL: "waiting_on_internal",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

export type TicketStatus = (typeof TICKET_STATUSES)[keyof typeof TICKET_STATUSES];

/** Support message sender types */
export const SENDER_TYPES = {
  CUSTOMER: "customer",
  ADMIN: "admin",
  SYSTEM: "system",
} as const;

export type SenderType = (typeof SENDER_TYPES)[keyof typeof SENDER_TYPES];

/** SLA targets in hours */
export const SLA_TARGETS = {
  urgent: { firstResponse: 1, resolution: 4 },
  high: { firstResponse: 4, resolution: 8 },
  medium: { firstResponse: 8, resolution: 24 },
  low: { firstResponse: 16, resolution: 40 },
} as const;

/** Stripe coupon IDs for bundle discounts */
export const STRIPE_COUPONS = {
  BUNDLE_10_PERCENT: "bundle_10_percent",
  BUNDLE_15_PERCENT: "bundle_15_percent",
} as const;
