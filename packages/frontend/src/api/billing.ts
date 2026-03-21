import type {
  SubscriptionResponse,
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  InvoiceResponse,
} from "@opshield/shared";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client.js";

export function fetchSubscription(
  tenantId: string,
): Promise<SubscriptionResponse> {
  return apiGet<SubscriptionResponse>(`/tenants/${tenantId}/subscription`);
}

export function createSubscription(
  tenantId: string,
  data: CreateSubscriptionInput,
): Promise<SubscriptionResponse> {
  return apiPost<SubscriptionResponse>(
    `/tenants/${tenantId}/subscription`,
    data,
  );
}

export function syncSubscription(
  tenantId: string,
): Promise<SubscriptionResponse> {
  return apiPatch<SubscriptionResponse>(
    `/tenants/${tenantId}/subscription`,
    {},
  );
}

export function cancelSubscription(
  tenantId: string,
  data: CancelSubscriptionInput,
): Promise<void> {
  return apiDelete(`/tenants/${tenantId}/subscription`, data);
}

export function fetchInvoices(tenantId: string): Promise<InvoiceResponse[]> {
  return apiGet<InvoiceResponse[]>(`/tenants/${tenantId}/invoices`);
}
