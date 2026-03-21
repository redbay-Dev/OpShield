import { useQuery } from "@tanstack/react-query";
import {
  fetchWebhookDeliveries,
  type WebhookDeliveryListParams,
} from "@frontend/api/webhook-deliveries.js";

export function useWebhookDeliveries(params?: WebhookDeliveryListParams) {
  return useQuery({
    queryKey: ["webhook-deliveries", params],
    queryFn: () => fetchWebhookDeliveries(params),
  });
}
