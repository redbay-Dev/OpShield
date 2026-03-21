import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("impersonation routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/impersonate", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/impersonate",
        payload: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          product: "nexum",
          reason: "support ticket",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/impersonate", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/impersonate",
        payload: { token: "fake-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/impersonate/validate", () => {
    it("returns 401 without service auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/impersonate/validate?token=fake-token",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
