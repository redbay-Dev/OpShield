import { apiGet } from "./client.js";

export interface RevenueByItem {
  productId?: string;
  moduleId?: string;
  amount: number;
}

export interface TenantCounts {
  total: number;
  active: number;
  onboarding: number;
  suspended: number;
  cancelled: number;
  trial: number;
}

export interface RevenueAnalytics {
  mrr: number;
  activeTenants: number;
  churnRate: number;
  arpu: number;
  revenueByProduct: RevenueByItem[];
  revenueByModule: RevenueByItem[];
  tenantCounts: TenantCounts;
}

export function fetchRevenueAnalytics(): Promise<RevenueAnalytics> {
  return apiGet<RevenueAnalytics>("/analytics/revenue");
}
