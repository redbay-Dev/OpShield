import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog, type AuditLogListParams } from "@frontend/api/audit-log.js";

export function useAuditLog(params?: AuditLogListParams) {
  return useQuery({
    queryKey: ["audit-log", params],
    queryFn: () => fetchAuditLog(params),
  });
}
