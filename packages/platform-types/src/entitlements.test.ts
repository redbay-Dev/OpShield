import { describe, it, expect } from "vitest";
import { entitlementsResponseSchema, moduleEntitlementSchema } from "./entitlements.js";

describe("entitlements schema", () => {
  it("validates a correct entitlements response", () => {
    const valid = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      tenantStatus: "active",
      modules: [
        {
          productId: "safespec",
          moduleId: "safespec-whs",
          status: "active",
          maxUsers: 10,
          currentUsers: 3,
        },
      ],
    };

    const result = entitlementsResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates response with plan info", () => {
    const valid = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      tenantStatus: "active",
      modules: [
        {
          productId: "safespec",
          moduleId: "safespec-whs",
          status: "active",
          maxUsers: 10,
          currentUsers: 3,
          plan: {
            tier: "professional",
            includedUsers: 10,
            basePrice: "99.00",
            perUserPrice: "7.00",
          },
        },
      ],
    };

    const result = entitlementsResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates response with null plan", () => {
    const valid = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      tenantStatus: "active",
      modules: [
        {
          productId: "nexum",
          moduleId: "nexum-core",
          status: "active",
          maxUsers: 5,
          currentUsers: 1,
          plan: null,
        },
      ],
    };

    const result = entitlementsResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid tenant status", () => {
    const invalid = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      tenantStatus: "unknown",
      modules: [],
    };

    const result = entitlementsResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid module status", () => {
    const result = moduleEntitlementSchema.safeParse({
      productId: "safespec",
      moduleId: "safespec-whs",
      status: "deleted",
      maxUsers: 10,
      currentUsers: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative currentUsers", () => {
    const result = moduleEntitlementSchema.safeParse({
      productId: "safespec",
      moduleId: "safespec-whs",
      status: "active",
      maxUsers: 10,
      currentUsers: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero maxUsers", () => {
    const result = moduleEntitlementSchema.safeParse({
      productId: "safespec",
      moduleId: "safespec-whs",
      status: "active",
      maxUsers: 0,
      currentUsers: 0,
    });
    expect(result.success).toBe(false);
  });
});
