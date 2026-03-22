import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@frontend/api/client.js";
import type { PublicPlanResponse } from "@opshield/shared/schemas";

export function usePlans(): ReturnType<typeof useQuery<PublicPlanResponse[]>> {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<PublicPlanResponse[]> => {
      return apiGet<PublicPlanResponse[]>("/plans");
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}
