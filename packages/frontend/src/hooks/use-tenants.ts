import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTenantInput,
  UpdateTenantInput,
  AddModuleInput,
  UpdateModuleInput,
} from "@opshield/shared";
import {
  fetchTenants,
  fetchTenant,
  createTenant,
  updateTenant,
  fetchTenantEntitlements,
  addModule,
  updateModule,
  removeModule,
  type TenantListParams,
} from "@frontend/api/tenants.js";

export function useTenants(params?: TenantListParams) {
  return useQuery({
    queryKey: ["tenants", params],
    queryFn: () => fetchTenants(params),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ["tenants", id],
    queryFn: () => fetchTenant(id),
    enabled: Boolean(id),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTenantInput) => createTenant(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTenantInput) => updateTenant(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useTenantEntitlements(tenantId: string) {
  return useQuery({
    queryKey: ["tenants", tenantId, "entitlements"],
    queryFn: () => fetchTenantEntitlements(tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useAddModule(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddModuleInput) => addModule(tenantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "entitlements"],
      });
    },
  });
}

export function useUpdateModule(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      moduleId,
      data,
    }: {
      moduleId: string;
      data: UpdateModuleInput;
    }) => updateModule(tenantId, moduleId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "entitlements"],
      });
    },
  });
}

export function useRemoveModule(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (moduleId: string) => removeModule(tenantId, moduleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "entitlements"],
      });
    },
  });
}
