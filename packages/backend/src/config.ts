import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(import.meta.dirname, "../../..", ".env.development"), override: true });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  api: {
    port: Number(process.env.API_PORT ?? 3000),
    host: process.env.API_HOST ?? "0.0.0.0",
  },
  database: {
    url: process.env.DATABASE_URL!,
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "devuser",
    password: process.env.DATABASE_PASSWORD ?? "",
    name: process.env.DATABASE_NAME ?? "opshield_dev",
  },
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? "",
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "opshield:",
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
    accessKey: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.STORAGE_SECRET_KEY ?? "",
    bucket: process.env.STORAGE_BUCKET ?? "opshield-dev",
    region: process.env.STORAGE_REGION ?? "us-east-1",
  },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET ?? "change-me-in-development",
    url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "noreply@nexum.net.au",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5170",
  productUrls: {
    nexum: process.env.NEXUM_URL ?? "http://localhost:5171",
    safespec: process.env.SAFESPEC_URL ?? "http://localhost:5172",
  },
  webhooks: {
    nexum: {
      url: process.env.WEBHOOK_NEXUM_URL ?? "",
      secret: process.env.WEBHOOK_NEXUM_SECRET ?? "",
    },
    safespec: {
      url: process.env.WEBHOOK_SAFESPEC_URL ?? "",
      secret: process.env.WEBHOOK_SAFESPEC_SECRET ?? "",
    },
  },
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
