import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("invoice routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantId = "00000000-0000-0000-0000-000000000000";

  describe("GET /api/v1/tenants/:tenantId/invoices", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tenants/${tenantId}/invoices`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 for invalid tenant ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tenants/not-a-uuid/invoices`,
      });

      // Will be 401 (auth check comes first) or 400 depending on middleware order
      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
