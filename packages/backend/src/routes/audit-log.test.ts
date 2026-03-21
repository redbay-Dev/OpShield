import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("audit log routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/audit-log", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/audit-log",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("accepts query parameters without auth (still 401)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/audit-log?action=tenant.created&resourceType=tenant&page=1&limit=10",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
