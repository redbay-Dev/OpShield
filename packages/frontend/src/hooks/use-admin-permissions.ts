import { useMemo } from "react";
import { ADMIN_ROLE_PERMISSIONS, type AdminRole } from "@opshield/shared/constants";
import { useAdminStatus } from "./use-admin-status.js";
import { authClient } from "@frontend/lib/auth-client.js";

interface AdminPermissions {
  role: AdminRole | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isLoading: boolean;
}

export function useAdminPermissions(): AdminPermissions {
  const { data: session } = authClient.useSession();
  const { data: adminStatus, isPending } = useAdminStatus(Boolean(session));

  return useMemo(() => {
    const role = adminStatus?.role ?? null;
    if (!role || !(role in ADMIN_ROLE_PERMISSIONS)) {
      return {
        role,
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        isLoading: isPending,
      };
    }

    const perms = ADMIN_ROLE_PERMISSIONS[role];
    return {
      role,
      canRead: perms.read,
      canCreate: perms.create,
      canUpdate: perms.update,
      canDelete: perms.delete,
      isLoading: isPending,
    };
  }, [adminStatus?.role, isPending]);
}
