import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpsertSsoProviderInput } from "@opshield/shared";
import {
  fetchSsoProviders,
  upsertSsoProvider,
  deleteSsoProvider,
} from "@frontend/api/sso-providers.js";

export function useSsoProviders(tenantId: string) {
  return useQuery({
    queryKey: ["tenants", tenantId, "sso-providers"],
    queryFn: () => fetchSsoProviders(tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useUpsertSsoProvider(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertSsoProviderInput) =>
      upsertSsoProvider(tenantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "sso-providers"],
      });
    },
  });
}

export function useDeleteSsoProvider(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => deleteSsoProvider(tenantId, providerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "sso-providers"],
      });
    },
  });
}
