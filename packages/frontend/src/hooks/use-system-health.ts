import { useQuery } from "@tanstack/react-query";
import { fetchSystemHealth } from "@frontend/api/system-health.js";

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
  });
}
