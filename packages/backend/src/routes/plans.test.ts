import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("plan routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/plans/admin", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/plans/admin",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/plans", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/plans",
        payload: {
          name: "Test Plan",
          productId: "safespec",
          moduleId: "safespec-whs",
          tier: "test",
          basePrice: "49.00",
          includedUsers: 5,
          perUserPrice: "5.00",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/plans/:planId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/plans/00000000-0000-0000-0000-000000000001",
        payload: { name: "Updated Plan" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/plans/:planId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/plans/00000000-0000-0000-0000-000000000001",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
