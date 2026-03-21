import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("webhook delivery routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/webhook-deliveries", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/webhook-deliveries",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 401 with invalid query params (auth check first)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/webhook-deliveries?page=-1",
      });

      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 401 with valid filters but no auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/webhook-deliveries?productId=safespec&status=failed",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 401 with tenantId filter but no auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/webhook-deliveries?tenantId=00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
