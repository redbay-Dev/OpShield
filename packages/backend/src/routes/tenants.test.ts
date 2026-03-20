import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("tenant routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/tenants", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/tenants", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tenants",
        payload: {
          name: "Test Tenant",
          slug: "test-tenant",
          billingEmail: "test@example.com",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/tenants/:tenantId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/tenants/:tenantId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000",
        payload: { name: "Updated" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
