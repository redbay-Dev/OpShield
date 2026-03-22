import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@frontend/api/client.js";

export interface MigrationProduct {
  id: string;
  productId: string;
  latestVersion: string | null;
  totalMigrations: number;
  lastReportedAt: string | null;
}

export interface MigrationTenantState {
  state: {
    id: string;
    productId: string;
    tenantId: string;
    schemaName: string;
    currentVersion: string | null;
    appliedCount: number;
    status: "current" | "behind" | "failed";
    error: string | null;
    lastMigratedAt: string | null;
  };
  tenantName: string | null;
  tenantSlug: string | null;
  tenantStatus: string | null;
}

export interface MigrationSummary {
  nexum: { current: number; behind: number; failed: number; total: number };
  safespec: { current: number; behind: number; failed: number; total: number };
}

export interface MigrationDashboardData {
  products: MigrationProduct[];
  states: MigrationTenantState[];
  summary: MigrationSummary;
}

export interface MigrationLogEntry {
  id: string;
  productId: string;
  action: string;
  tenantsAffected: number;
  summary: Record<string, unknown> | null;
  triggeredBy: string | null;
  createdAt: string;
}

export function useMigrationDashboard() {
  return useQuery<MigrationDashboardData>({
    queryKey: ["migration-state"],
    queryFn: () => apiGet<MigrationDashboardData>("/migration-state"),
    refetchInterval: 30000,
  });
}

export function useMigrationLog(productId?: string) {
  const params: Record<string, string> = {};
  if (productId) params["productId"] = productId;
  return useQuery<MigrationLogEntry[]>({
    queryKey: ["migration-log", productId],
    queryFn: () => apiGet<MigrationLogEntry[]>("/migration-state/log", params),
  });
}

export function useTriggerMigration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { productId: string; tenantId?: string }) =>
      apiPost<{ message: string }>("/migration-state/trigger", params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["migration-state"] });
      void queryClient.invalidateQueries({ queryKey: ["migration-log"] });
    },
  });
}
