import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("subscription routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantId = "00000000-0000-0000-0000-000000000000";

  describe("POST /api/v1/tenants/:tenantId/subscription", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tenants/${tenantId}/subscription`,
        payload: { billingInterval: "monthly" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/tenants/:tenantId/subscription", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tenants/${tenantId}/subscription`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/tenants/:tenantId/subscription", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/tenants/${tenantId}/subscription`,
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/tenants/:tenantId/subscription", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/tenants/${tenantId}/subscription`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
