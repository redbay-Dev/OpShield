import { useQuery } from "@tanstack/react-query";

interface SecurityStatusResponse {
  success: boolean;
  data: {
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
  };
}

interface SecurityStatus {
  twoFactorEnabled: boolean | undefined;
  mustChangePassword: boolean | undefined;
  isPending: boolean;
}

/**
 * Check the current user's security status:
 * - Whether 2FA is enabled
 * - Whether they must change their password (bootstrap admin)
 */
export function useSecurityStatus(sessionActive: boolean): SecurityStatus {
  const { data, isPending } = useQuery({
    queryKey: ["security-status"],
    queryFn: async (): Promise<{ twoFactorEnabled: boolean; mustChangePassword: boolean }> => {
      const response = await fetch("/api/v1/me/2fa-status", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return { twoFactorEnabled: false, mustChangePassword: false };
      const json = (await response.json()) as SecurityStatusResponse;
      return json.data;
    },
    enabled: sessionActive,
    staleTime: 1000 * 60 * 5,
  });

  return {
    twoFactorEnabled: data?.twoFactorEnabled,
    mustChangePassword: data?.mustChangePassword,
    isPending,
  };
}
