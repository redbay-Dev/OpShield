import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("SSO provider routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/tenants/:tenantId/sso-providers", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/sso-providers",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/tenants/:tenantId/sso-providers", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/sso-providers",
        payload: {
          provider: "microsoft",
          clientId: "test-client-id",
          clientSecret: "test-secret",
          tenantIdAzure: "test-azure-tenant",
          enforced: false,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/tenants/:tenantId/sso-providers/:providerId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/sso-providers/00000000-0000-0000-0000-000000000001",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/sso/discover", () => {
    it("returns 400 without email parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sso/discover",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sso/discover?email=not-an-email",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns ssoRequired=false for unknown domain", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sso/discover?email=user@unknown-domain.com",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as { success: boolean; data: { ssoRequired: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.ssoRequired).toBe(false);
    });
  });
});
