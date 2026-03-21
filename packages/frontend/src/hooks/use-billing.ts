import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSubscriptionInput,
  CancelSubscriptionInput,
} from "@opshield/shared";
import {
  fetchSubscription,
  createSubscription,
  syncSubscription,
  cancelSubscription,
  fetchInvoices,
} from "@frontend/api/billing.js";

export function useSubscription(tenantId: string) {
  return useQuery({
    queryKey: ["tenants", tenantId, "subscription"],
    queryFn: () => fetchSubscription(tenantId),
    enabled: Boolean(tenantId),
    retry: false,
  });
}

export function useCreateSubscription(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSubscriptionInput) =>
      createSubscription(tenantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "subscription"],
      });
    },
  });
}

export function useSyncSubscription(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncSubscription(tenantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "subscription"],
      });
    },
  });
}

export function useCancelSubscription(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CancelSubscriptionInput) =>
      cancelSubscription(tenantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "subscription"],
      });
    },
  });
}

export function useInvoices(tenantId: string) {
  return useQuery({
    queryKey: ["tenants", tenantId, "invoices"],
    queryFn: () => fetchInvoices(tenantId),
    enabled: Boolean(tenantId),
  });
}
