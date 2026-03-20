import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, jwt } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { tenantUsers } from "./db/schema/tenant-users.js";
import { config } from "./config.js";

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: config.auth.secret,
  baseURL: config.auth.url,
  trustedOrigins: [
    config.frontendUrl,
    config.productUrls.nexum,
    config.productUrls.safespec,
  ],

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  plugins: [
    twoFactor({
      issuer: "Redbay",
    }),
    jwt({
      jwt: {
        issuer: "opshield",
        expirationTime: "1h",
        definePayload: async ({ user }) => {
          const memberships = await db
            .select({
              tenantId: tenantUsers.tenantId,
              role: tenantUsers.role,
            })
            .from(tenantUsers)
            .where(eq(tenantUsers.userId, user.id));

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenant_memberships: memberships,
          };
        },
      },
      jwks: {
        jwksPath: "/.well-known/jwks.json",
      },
    }),
  ],
});

export type Auth = typeof auth;
