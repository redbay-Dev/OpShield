import { apiGet, apiPatch, apiPost } from "./client.js";

export interface TenantModule {
  productId: string;
  moduleId: string;
  status: string;
  maxUsers: number;
  currentUsers: number;
}

export interface TenantSubscription {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface MyTenant {
  tenantId: string;
  role: string;
  name: string;
  slug: string;
  status: string;
  billingEmail: string | null;
  createdAt: string;
  modules: TenantModule[];
  subscription: TenantSubscription | null;
}

export interface NotificationPreferences {
  billingEmails: boolean;
  supportEmails: boolean;
  productUpdates: boolean;
}

export interface BillingPortalResponse {
  url: string;
}

export function fetchMyTenants(): Promise<MyTenant[]> {
  return apiGet<MyTenant[]>("/me/tenants");
}

export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return apiGet<NotificationPreferences>("/me/notification-preferences");
}

export function updateNotificationPreferences(
  data: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiPatch<NotificationPreferences>(
    "/me/notification-preferences",
    data,
  );
}

export function createBillingPortalSession(): Promise<BillingPortalResponse> {
  return apiPost<BillingPortalResponse>("/me/billing-portal", {});
}

export function logoutEverywhere(): Promise<{ loggedOut: boolean }> {
  return apiPost<{ loggedOut: boolean }>("/me/logout-everywhere", {});
}
