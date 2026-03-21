import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("support ticket routes (tenant-facing)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/support/tickets", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/tickets",
        payload: {
          productId: "safespec",
          tenantId: "00000000-0000-0000-0000-000000000001",
          userId: "user-1",
          userEmail: "user@example.com",
          userName: "Test User",
          subject: "Test ticket",
          description: "This is a test ticket",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/support/tickets", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/support/tickets?tenantId=00000000-0000-0000-0000-000000000001",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/support/tickets/:ticketNumber", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/support/tickets/T-001",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/support/tickets/:ticketNumber/messages", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/tickets/T-001/messages",
        payload: {
          body: "Reply text",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/support/tickets/:ticketNumber/attachments", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/tickets/T-001/attachments",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/support/tickets/:ticketNumber/attachments", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/support/tickets/T-001/attachments",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/support/tickets/:ticketNumber/attachments/:attachmentId/download", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/support/tickets/T-001/attachments/00000000-0000-0000-0000-000000000001/download",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
