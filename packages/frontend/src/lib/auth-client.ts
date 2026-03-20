import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const baseURL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/auth`
    : "http://localhost:5170/api/auth";

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/auth/2fa-verify";
      },
    }),
  ],
});
