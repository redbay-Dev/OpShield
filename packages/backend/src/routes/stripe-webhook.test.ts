import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("stripe webhook route", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/webhooks/stripe", () => {
    it("returns 400 when stripe-signature header is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/stripe",
        payload: JSON.stringify({ type: "test" }),
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("MISSING_SIGNATURE");
    });

    it("returns 400 when stripe-signature is invalid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/stripe",
        payload: JSON.stringify({ type: "test" }),
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1234,v1=invalid_signature",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_SIGNATURE");
    });
  });
});
