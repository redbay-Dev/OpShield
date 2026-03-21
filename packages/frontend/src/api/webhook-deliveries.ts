import type { WebhookDeliveryResponse } from "@opshield/shared";
import { apiGet } from "./client.js";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface WebhookDeliveryListParams {
  page?: number;
  limit?: number;
  tenantId?: string;
  productId?: string;
  eventType?: string;
  status?: string;
}

export function fetchWebhookDeliveries(
  params?: WebhookDeliveryListParams,
): Promise<PaginatedResponse<WebhookDeliveryResponse>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.tenantId) queryParams.tenantId = params.tenantId;
  if (params?.productId) queryParams.productId = params.productId;
  if (params?.eventType) queryParams.eventType = params.eventType;
  if (params?.status) queryParams.status = params.status;

  return apiGet<PaginatedResponse<WebhookDeliveryResponse>>(
    "/webhook-deliveries",
    queryParams,
  );
}

export type { WebhookDeliveryListParams };
