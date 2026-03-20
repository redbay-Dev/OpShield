import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("module routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/tenants/:tenantId/modules", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/modules",
        payload: {
          productId: "safespec",
          moduleId: "safespec-whs",
          maxUsers: 5,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/tenants/:tenantId/modules/:moduleId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/modules/safespec-whs",
        payload: { status: "suspended" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/tenants/:tenantId/modules/:moduleId", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/tenants/00000000-0000-0000-0000-000000000000/modules/safespec-whs",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
