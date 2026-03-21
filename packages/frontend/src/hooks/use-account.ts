import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyTenants,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  createBillingPortalSession,
  logoutEverywhere,
  type NotificationPreferences,
} from "@frontend/api/account.js";

export function useMyTenants() {
  return useQuery({
    queryKey: ["my-tenants"],
    queryFn: fetchMyTenants,
    staleTime: 1000 * 60 * 2,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchNotificationPreferences,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: createBillingPortalSession,
  });
}

export function useLogoutEverywhere() {
  return useMutation({
    mutationFn: logoutEverywhere,
  });
}
