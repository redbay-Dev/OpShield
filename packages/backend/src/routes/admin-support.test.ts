import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("admin support routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/admin/support/tickets", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/support/tickets",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("accepts filter query parameters (still 401)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/support/tickets?status=open&priority=high&productId=safespec&page=1&limit=10",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/admin/support/tickets/:ticketNumber", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/support/tickets/T-001",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/admin/support/tickets/:ticketNumber/messages", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/support/tickets/T-001/messages",
        payload: {
          body: "Admin reply",
          isInternalNote: false,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/admin/support/tickets/:ticketNumber", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/support/tickets/T-001",
        payload: {
          status: "in_progress",
          priority: "high",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/support/stats", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/support/stats",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/support/canned-responses", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/support/canned-responses",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/admin/support/canned-responses", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/support/canned-responses",
        payload: {
          title: "Test Response",
          body: "This is a canned response",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
