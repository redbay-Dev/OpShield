import type { AuditLogResponse } from "@opshield/shared";
import { apiGet } from "./client.js";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

export function fetchAuditLog(
  params?: AuditLogListParams,
): Promise<PaginatedResponse<AuditLogResponse>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.action) queryParams.action = params.action;
  if (params?.resourceType) queryParams.resourceType = params.resourceType;
  if (params?.actorId) queryParams.actorId = params.actorId;
  if (params?.resourceId) queryParams.resourceId = params.resourceId;
  if (params?.from) queryParams.from = params.from;
  if (params?.to) queryParams.to = params.to;

  return apiGet<PaginatedResponse<AuditLogResponse>>("/audit-log", queryParams);
}
