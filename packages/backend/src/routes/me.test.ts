import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("me routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/me/admin-status", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/admin-status",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/me/notification-preferences", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/notification-preferences",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/me/notification-preferences", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/me/notification-preferences",
        payload: { billingEmails: false },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/me/logout-everywhere", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/logout-everywhere",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/me/tenants", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/tenants",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/me/billing-portal", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/billing-portal",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
