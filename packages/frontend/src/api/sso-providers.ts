import type { SsoProviderResponse, UpsertSsoProviderInput } from "@opshield/shared";
import { apiGet, apiDelete } from "./client.js";

export function fetchSsoProviders(
  tenantId: string,
): Promise<SsoProviderResponse[]> {
  return apiGet<SsoProviderResponse[]>(`/tenants/${tenantId}/sso-providers`);
}

export function upsertSsoProvider(
  tenantId: string,
  data: UpsertSsoProviderInput,
): Promise<SsoProviderResponse> {
  // PUT request — use apiPatch with method override since we don't have apiPut
  return fetch(`/api/v1/tenants/${tenantId}/sso-providers`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw new Error("Failed to save SSO provider");
    const json = (await res.json()) as { data: SsoProviderResponse };
    return json.data;
  });
}

export function deleteSsoProvider(
  tenantId: string,
  providerId: string,
): Promise<void> {
  return apiDelete(`/tenants/${tenantId}/sso-providers/${providerId}`);
}
