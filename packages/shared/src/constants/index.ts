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

// ---------------------------------------------------------------------------
// Product & Module Configuration
// ---------------------------------------------------------------------------

/** Tier definition for base modules */
export interface TierConfig {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
}

/** Base module config (tiered, user-based pricing) */
export interface BaseModuleConfig {
  readonly id: string;
  readonly name: string;
  readonly fullName: string;
  readonly description: string;
  readonly required: boolean;
  readonly tiers: readonly TierConfig[];
  /** Features included in the base price — shown on pricing page */
  readonly includedFeatures?: readonly string[];
}

/** Add-on module config (flat-rate pricing) */
export interface AddonConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requires?: string;
  readonly requiresProduct?: string;
}

/** Product configuration */
export interface ProductConfig {
  readonly name: string;
  readonly tagline: string;
  readonly icon: string;
  readonly baseModules: readonly BaseModuleConfig[];
  readonly addons: readonly AddonConfig[];
}

export type ProductId = "safespec" | "nexum";

/**
 * Rich product configuration — single source of truth for product structure,
 * module categorisation, tier definitions, and dependency rules.
 */
export const PRODUCT_CONFIG: Record<ProductId, ProductConfig> = {
  safespec: {
    name: "SafeSpec",
    tagline:
      "Manage workplace safety, run inspections, track incidents, and stay compliant with Australian WHS and heavy vehicle regulations.",
    icon: "ShieldCheck",
    baseModules: [
      {
        id: SAFESPEC_MODULES.WHS,
        name: "WHS",
        fullName: "Work Health & Safety",
        description:
          "Run safety inspections, log incidents, manage hazards, create Safe Work Method Statements, and track corrective actions — all in one place.",
        required: false,
        tiers: [
          {
            id: "starter",
            label: "Starter",
            subtitle: "For small teams getting started with digital safety",
          },
          {
            id: "growth",
            label: "Growth",
            subtitle: "For growing businesses with multiple sites or crews",
          },
          {
            id: "business",
            label: "Business",
            subtitle: "For larger operations needing advanced reporting",
          },
          {
            id: "enterprise",
            label: "Enterprise",
            subtitle: "Custom pricing for 50+ users",
          },
        ],
      },
      {
        id: SAFESPEC_MODULES.HVA,
        name: "HVA",
        fullName: "Heavy Vehicle Accreditation",
        description:
          "Meet NHVR accreditation requirements — fatigue management, mass management, fitness-to-drive checks, safety management system builder, and Chain of Responsibility compliance.",
        required: false,
        tiers: [
          {
            id: "solo",
            label: "Solo Operator",
            subtitle: "Owner-drivers and single-vehicle operators",
          },
          {
            id: "small-fleet",
            label: "Small Fleet",
            subtitle: "Fleets with up to 10 vehicles",
          },
          {
            id: "medium-fleet",
            label: "Medium Fleet",
            subtitle: "Fleets with up to 25 vehicles",
          },
          {
            id: "enterprise",
            label: "Enterprise",
            subtitle: "Custom pricing for large fleets",
          },
        ],
      },
    ],
    addons: [
      {
        id: SAFESPEC_MODULES.FLEET_MAINTENANCE,
        name: "Fleet Maintenance",
        description:
          "Schedule vehicle services, track defects, and maintain compliance records for your fleet.",
        requires: SAFESPEC_MODULES.HVA,
      },
    ],
  },
  nexum: {
    name: "Nexum",
    tagline:
      "Run your transport and logistics operations — manage jobs, schedule drivers, coordinate deliveries, and keep everything connected.",
    icon: "Truck",
    baseModules: [
      {
        id: NEXUM_MODULES.CORE,
        name: "Core",
        fullName: "Nexum",
        description:
          "Everything you need to run transport operations — jobs, scheduling, Xero sync, dockets, maps, reporting, compliance, and a customer/driver portal. All included.",
        required: true,
        includedFeatures: [
          "Jobs & scheduling",
          "Business entities & contacts",
          "Dashboard & analytics",
          "Xero accounting sync",
          "Docket processing",
          "Materials tracking",
          "Map-based route planning",
          "Reporting & custom dashboards",
          "Customer & driver portal",
          "SafeSpec compliance bridge (free with SafeSpec)",
        ],
        tiers: [
          {
            id: "starter",
            label: "Starter",
            subtitle: "For small transport businesses with a few drivers",
          },
          {
            id: "professional",
            label: "Professional",
            subtitle: "For established operators managing larger teams",
          },
          {
            id: "enterprise",
            label: "Enterprise",
            subtitle: "Custom pricing for large-scale operations",
          },
        ],
      },
    ],
    addons: [
      {
        id: NEXUM_MODULES.INVOICING,
        name: "Invoicing & RCTI",
        description:
          "Generate invoices from completed jobs and automatically create subcontractor invoices (RCTI).",
      },
      {
        id: NEXUM_MODULES.SMS,
        name: "SMS Notifications",
        description:
          "Send automated text messages to drivers and customers for job updates, reminders, and alerts.",
      },
      {
        id: NEXUM_MODULES.AI,
        name: "AI Automation",
        description:
          "Use AI to auto-allocate jobs, predict scheduling conflicts, and generate reports.",
      },
    ],
  },
} as const;

/** All product IDs */
export const PRODUCT_IDS: readonly ProductId[] = ["safespec", "nexum"];

/**
 * Determine bundle discount percentage based on selected modules.
 * Both products → 10%. 3+ modules across both → 15%.
 */
export function getBundleDiscountPercent(
  modules: ReadonlyArray<{ productId: string }>,
): number {
  const products = new Set(modules.map((m) => m.productId));
  if (products.size < 2) return 0;
  return modules.length >= 3 ? 15 : 10;
}

/**
 * Look up module display name from PRODUCT_CONFIG.
 */
export function getModuleDisplayName(moduleId: string): string {
  for (const product of Object.values(PRODUCT_CONFIG)) {
    for (const mod of product.baseModules) {
      if (mod.id === moduleId) return mod.fullName;
    }
    for (const addon of product.addons) {
      if (addon.id === moduleId) return addon.name;
    }
  }
  return moduleId;
}

/**
 * Determine which product a module belongs to.
 */
export function getProductForModule(
  moduleId: string,
): ProductId | undefined {
  for (const [productId, product] of Object.entries(PRODUCT_CONFIG)) {
    const allModuleIds = [
      ...product.baseModules.map((m) => m.id),
      ...product.addons.map((a) => a.id),
    ];
    if (allModuleIds.includes(moduleId)) return productId as ProductId;
  }
  return undefined;
}
