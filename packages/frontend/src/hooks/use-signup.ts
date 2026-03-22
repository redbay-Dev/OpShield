import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@frontend/api/client.js";

interface SlugCheckResponse {
  success: boolean;
  data: { available: boolean };
}

interface CheckoutResponse {
  checkoutUrl: string;
}

interface CheckoutInput {
  companyName: string;
  companySlug: string;
  billingEmail: string;
  billingInterval: "monthly" | "annual";
  modules: Array<{ productId: string; moduleId: string; tier: string }>;
}

export function useCheckSlug(slug: string, enabled: boolean): ReturnType<typeof useQuery<boolean>> {
  return useQuery({
    queryKey: ["check-slug", slug],
    queryFn: async (): Promise<boolean> => {
      const result = await apiGet<SlugCheckResponse>("/signup/check-slug", { slug });
      return result.data.available;
    },
    enabled: enabled && slug.length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useCheckout(): ReturnType<typeof useMutation<string, Error, CheckoutInput>> {
  return useMutation({
    mutationFn: async (input: CheckoutInput): Promise<string> => {
      const result = await apiPost<CheckoutResponse>("/signup/checkout", input);
      return result.checkoutUrl;
    },
  });
}
