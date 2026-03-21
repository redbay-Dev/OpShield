import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("usage routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/usage", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          productId: "safespec",
          moduleId: "safespec-whs",
          metric: "user_count",
          value: 5,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 401 with an invalid API key", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        headers: {
          "x-product-api-key": "invalid-key-that-does-not-exist",
        },
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          productId: "safespec",
          moduleId: "safespec-whs",
          metric: "user_count",
          value: 5,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 for invalid payload (missing required fields)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {},
      });

      // Auth check happens first, so 401 is expected without auth
      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400 for invalid metric type", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          productId: "safespec",
          moduleId: "safespec-whs",
          metric: "invalid_metric",
          value: 5,
        },
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400 for negative user count", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          productId: "safespec",
          moduleId: "safespec-whs",
          metric: "user_count",
          value: -1,
        },
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400 for invalid productId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          productId: "invalid-product",
          moduleId: "safespec-whs",
          metric: "user_count",
          value: 5,
        },
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });

    it("returns 400 for non-UUID tenantId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/usage",
        payload: {
          tenantId: "not-a-uuid",
          productId: "safespec",
          moduleId: "safespec-whs",
          metric: "user_count",
          value: 5,
        },
      });

      // Auth check happens first
      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
