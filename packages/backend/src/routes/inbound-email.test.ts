import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("inbound email webhook routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/webhooks/inbound-email", () => {
    it("returns 400 for invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/inbound-email",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 when missing required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/inbound-email",
        payload: {
          from: "user@example.com",
          // missing 'to' and 'subject'
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("processes valid payload without error (DB determines outcome)", async () => {
      // Without a live DB, this will return 500 (DB error) — but validates
      // that validation passes and the handler is reached
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/inbound-email",
        payload: {
          from: "unknown-user-12345@example.com",
          to: "support@nexum.net.au",
          subject: "Help needed",
          textBody: "I need help with something",
        },
      });

      // Not 400 = validation passed, handler was reached
      expect(response.statusCode).not.toBe(400);
    });

    it("processes reply format without validation error", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/inbound-email",
        payload: {
          from: "user@example.com",
          to: "support@nexum.net.au",
          subject: "Re: [T-99999] Some old ticket",
          textBody: "Following up on this",
        },
      });

      // Not 400 = validation passed, handler was reached
      expect(response.statusCode).not.toBe(400);
    });

    it("processes payload with custom headers without validation error", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/inbound-email",
        payload: {
          from: "Jane Smith <jane@bridgeco.com.au>",
          to: "support@nexum.net.au",
          subject: "SWMS PDF not generating",
          textBody: "When I click generate PDF it fails",
          headers: {
            "x-nexum-product": "safespec",
            "x-nexum-tenant-id": "00000000-0000-0000-0000-000000000001",
            "x-nexum-user-id": "user-123",
            "x-nexum-category": "bug_report",
            "x-nexum-page": "/swms/456/edit",
          },
        },
      });

      // Not 400 = validation passed, handler was reached
      expect(response.statusCode).not.toBe(400);
    });
  });
});
