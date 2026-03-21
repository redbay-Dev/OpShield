import type {
  TenantResponse,
  CreateTenantInput,
  UpdateTenantInput,
  EntitlementsResponse,
  AddModuleInput,
  UpdateModuleInput,
} from "@opshield/shared";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client.js";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TenantListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export function fetchTenants(
  params?: TenantListParams,
): Promise<PaginatedResponse<TenantResponse>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;
  if (params?.search) queryParams.search = params.search;

  return apiGet<PaginatedResponse<TenantResponse>>("/tenants", queryParams);
}

export function fetchTenant(id: string): Promise<TenantResponse> {
  return apiGet<TenantResponse>(`/tenants/${id}`);
}

export function createTenant(
  data: CreateTenantInput,
): Promise<TenantResponse> {
  return apiPost<TenantResponse>("/tenants", data);
}

export function updateTenant(
  id: string,
  data: UpdateTenantInput,
): Promise<TenantResponse> {
  return apiPatch<TenantResponse>(`/tenants/${id}`, data);
}

export function fetchTenantEntitlements(
  tenantId: string,
): Promise<EntitlementsResponse> {
  return apiGet<EntitlementsResponse>(`/tenants/${tenantId}/entitlements`);
}

// ── Module management ──

interface ModuleResponse {
  id: string;
  tenantId: string;
  productId: string;
  moduleId: string;
  status: string;
  maxUsers: number;
  currentUsers: number;
  createdAt: string;
  updatedAt: string;
}

export function addModule(
  tenantId: string,
  data: AddModuleInput,
): Promise<ModuleResponse> {
  return apiPost<ModuleResponse>(`/tenants/${tenantId}/modules`, data);
}

export function updateModule(
  tenantId: string,
  moduleId: string,
  data: UpdateModuleInput,
): Promise<ModuleResponse> {
  return apiPatch<ModuleResponse>(
    `/tenants/${tenantId}/modules/${moduleId}`,
    data,
  );
}

export function removeModule(
  tenantId: string,
  moduleId: string,
): Promise<void> {
  return apiDelete(`/tenants/${tenantId}/modules/${moduleId}`);
}

// ── Provisioning ──

interface ProvisioningStatusResponse {
  id: string;
  tenantId: string;
  productId: string;
  status: "pending" | "dispatched" | "success" | "failed";
  attempts: number;
  lastError: string | null;
  provisionedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProvisionTenantInput {
  ownerUserId?: string;
  ownerEmail?: string;
  ownerName?: string;
}

interface ProvisionResult {
  productId: string;
  status: string;
  error: string | null;
}

interface ProvisionResponse {
  results: ProvisionResult[];
}

interface RetryProvisioningInput {
  productId: "safespec" | "nexum";
}

export function fetchProvisioningStatus(
  tenantId: string,
): Promise<ProvisioningStatusResponse[]> {
  return apiGet<ProvisioningStatusResponse[]>(
    `/tenants/${tenantId}/provisioning-status`,
  );
}

export function provisionTenant(
  tenantId: string,
  data?: ProvisionTenantInput,
): Promise<ProvisionResponse> {
  return apiPost<ProvisionResponse>(
    `/tenants/${tenantId}/provision`,
    data ?? {},
  );
}

export function retryProvisioning(
  tenantId: string,
  data: RetryProvisioningInput,
): Promise<ProvisionResult> {
  return apiPost<ProvisionResult>(
    `/tenants/${tenantId}/retry-provisioning`,
    data,
  );
}

export type {
  PaginatedResponse,
  TenantListParams,
  ModuleResponse,
  ProvisioningStatusResponse,
  ProvisionTenantInput,
  ProvisionResponse,
  ProvisionResult,
  RetryProvisioningInput,
};
