import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@frontend/api/client.js";
import type { AdminRole } from "@opshield/shared/constants";

interface AdminStatus {
  isPlatformAdmin: boolean;
  role: AdminRole | null;
}

export function useAdminStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiGet<AdminStatus>("/me/admin-status"),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
}
