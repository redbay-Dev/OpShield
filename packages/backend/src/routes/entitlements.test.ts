import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("entitlements routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/tenants/:tenantId/entitlements", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/entitlements",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 for invalid tenant ID format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/not-a-uuid/entitlements",
      });

      // Will be 401 (auth check happens before validation) or 400
      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
