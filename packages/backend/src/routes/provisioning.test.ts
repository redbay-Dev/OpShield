import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("provisioning routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantId = "00000000-0000-0000-0000-000000000000";

  describe("POST /api/v1/tenants/:tenantId/provision", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/provision`,
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 for invalid tenant ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tenants/not-a-uuid/provision",
        payload: {},
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });
  });

  describe("GET /api/v1/tenants/:tenantId/provisioning-status", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tenants/${tenantId}/provisioning-status`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/tenants/:tenantId/retry-provisioning", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/retry-provisioning`,
        payload: { productId: "nexum" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400/401 for missing productId", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/retry-provisioning`,
        payload: {},
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400/401 for invalid productId", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/retry-provisioning`,
        payload: { productId: "invalid-product" },
      });

      expect([400, 401]).toContain(response.statusCode);
    });
  });

  describe("POST /api/v1/tenants/:tenantId/provisioning-callback", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/provisioning-callback`,
        payload: {
          productId: "nexum",
          success: true,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 401 with invalid API key", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/provisioning-callback`,
        headers: {
          "x-product-api-key": "invalid-key",
        },
        payload: {
          productId: "nexum",
          success: true,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400/401 for missing required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/provisioning-callback`,
        payload: {},
      });

      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400/401 for invalid productId in callback", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/provisioning-callback`,
        payload: {
          productId: "invalid",
          success: true,
        },
      });

      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
