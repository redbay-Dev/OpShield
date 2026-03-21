import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("signup routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/plans", () => {
    it("returns plans without authentication (public)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/plans",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("GET /api/v1/signup/check-slug", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/signup/check-slug?slug=test-company",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/v1/signup/checkout", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/signup/checkout",
        payload: {
          companyName: "Test Company",
          companySlug: "test-company",
          billingEmail: "billing@test.com",
          billingInterval: "monthly",
          modules: [
            { productId: "safespec", moduleId: "safespec-whs", tier: "starter" },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("rejects invalid body shape (no auth needed to check parsing)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/signup/checkout",
        payload: {},
      });

      // Should be 401 since auth is checked before body validation
      expect(response.statusCode).toBe(401);
    });
  });
});

describe("signup schema validation", () => {
  it("validates signupCheckoutSchema correctly", async () => {
    const { signupCheckoutSchema } = await import("@opshield/shared/schemas");

    // Valid input
    const valid = signupCheckoutSchema.safeParse({
      companyName: "Test Company",
      companySlug: "test-company",
      billingEmail: "billing@test.com",
      billingInterval: "monthly",
      modules: [
        { productId: "safespec", moduleId: "safespec-whs", tier: "starter" },
      ],
    });
    expect(valid.success).toBe(true);

    // Missing modules
    const noModules = signupCheckoutSchema.safeParse({
      companyName: "Test Company",
      companySlug: "test-company",
      billingEmail: "billing@test.com",
      billingInterval: "monthly",
      modules: [],
    });
    expect(noModules.success).toBe(false);

    // Invalid slug
    const badSlug = signupCheckoutSchema.safeParse({
      companyName: "Test Company",
      companySlug: "Test Company!",
      billingEmail: "billing@test.com",
      billingInterval: "monthly",
      modules: [
        { productId: "safespec", moduleId: "safespec-whs", tier: "starter" },
      ],
    });
    expect(badSlug.success).toBe(false);

    // Invalid billing interval
    const badInterval = signupCheckoutSchema.safeParse({
      companyName: "Test Company",
      companySlug: "test-company",
      billingEmail: "billing@test.com",
      billingInterval: "weekly",
      modules: [
        { productId: "safespec", moduleId: "safespec-whs", tier: "starter" },
      ],
    });
    expect(badInterval.success).toBe(false);

    // Invalid email
    const badEmail = signupCheckoutSchema.safeParse({
      companyName: "Test Company",
      companySlug: "test-company",
      billingEmail: "not-an-email",
      billingInterval: "monthly",
      modules: [
        { productId: "safespec", moduleId: "safespec-whs", tier: "starter" },
      ],
    });
    expect(badEmail.success).toBe(false);
  });

  it("validates checkSlugQuerySchema correctly", async () => {
    const { checkSlugQuerySchema } = await import("@opshield/shared/schemas");

    const valid = checkSlugQuerySchema.safeParse({ slug: "my-company" });
    expect(valid.success).toBe(true);

    const tooShort = checkSlugQuerySchema.safeParse({ slug: "a" });
    expect(tooShort.success).toBe(false);

    const invalidChars = checkSlugQuerySchema.safeParse({ slug: "My Company!" });
    expect(invalidChars.success).toBe(false);
  });
});
