import { useQuery } from "@tanstack/react-query";
import { fetchRevenueAnalytics } from "@frontend/api/analytics.js";

export function useRevenueAnalytics() {
  return useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: fetchRevenueAnalytics,
  });
}
