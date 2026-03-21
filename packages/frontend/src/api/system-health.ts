import { apiGet } from "./client.js";

export interface ServiceHealth {
  name: string;
  status: "ok" | "unreachable" | "error";
  responseTimeMs: number;
  details?: Record<string, unknown>;
}

export interface SystemHealthResponse {
  services: ServiceHealth[];
  checkedAt: string;
}

export function fetchSystemHealth(): Promise<SystemHealthResponse> {
  return apiGet<SystemHealthResponse>("/system-health");
}
