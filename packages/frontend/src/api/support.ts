import type {
  SupportTicketResponse,
  SupportTicketDetailResponse,
  SupportMessageResponse,
  SupportStatsResponse,
  CannedResponseItem,
  UpdateTicketInput,
  CreateTicketMessageInput,
  CreateCannedResponseInput,
} from "@opshield/shared";
import { apiGet, apiPost, apiPatch } from "./client.js";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupportTicketListItem extends SupportTicketResponse {
  tenantName?: string;
}

export interface AdminTicketListParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  productId?: string;
  tenantId?: string;
  assignedTo?: string;
  category?: string;
}

export function fetchAdminTickets(
  params?: AdminTicketListParams,
): Promise<PaginatedResponse<SupportTicketListItem>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;
  if (params?.priority) queryParams.priority = params.priority;
  if (params?.productId) queryParams.productId = params.productId;
  if (params?.tenantId) queryParams.tenantId = params.tenantId;
  if (params?.assignedTo) queryParams.assignedTo = params.assignedTo;
  if (params?.category) queryParams.category = params.category;

  return apiGet<PaginatedResponse<SupportTicketListItem>>(
    "/admin/support/tickets",
    queryParams,
  );
}

export function fetchAdminTicketDetail(
  ticketNumber: string,
): Promise<SupportTicketDetailResponse> {
  return apiGet<SupportTicketDetailResponse>(
    `/admin/support/tickets/${ticketNumber}`,
  );
}

export function updateTicket(
  ticketNumber: string,
  data: UpdateTicketInput,
): Promise<SupportTicketResponse> {
  return apiPatch<SupportTicketResponse>(
    `/admin/support/tickets/${ticketNumber}`,
    data,
  );
}

export function addAdminMessage(
  ticketNumber: string,
  data: CreateTicketMessageInput,
): Promise<SupportMessageResponse> {
  return apiPost<SupportMessageResponse>(
    `/admin/support/tickets/${ticketNumber}/messages`,
    data,
  );
}

export function fetchSupportStats(): Promise<SupportStatsResponse> {
  return apiGet<SupportStatsResponse>("/admin/support/stats");
}

export function fetchCannedResponses(): Promise<CannedResponseItem[]> {
  return apiGet<CannedResponseItem[]>("/admin/support/canned-responses");
}

export function createCannedResponse(
  data: CreateCannedResponseInput,
): Promise<CannedResponseItem> {
  return apiPost<CannedResponseItem>("/admin/support/canned-responses", data);
}
