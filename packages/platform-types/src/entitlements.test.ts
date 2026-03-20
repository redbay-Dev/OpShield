import { describe, it, expect } from "vitest";
import { entitlementsResponseSchema } from "./entitlements.js";

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

  it("rejects invalid tenant status", () => {
    const invalid = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      tenantStatus: "unknown",
      modules: [],
    };

    const result = entitlementsResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
