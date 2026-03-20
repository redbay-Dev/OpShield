import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  updateTenantSchema,
  addModuleSchema,
  updateModuleSchema,
  moduleIdParamSchema,
  tenantIdParamSchema,
  tenantListQuerySchema,
  moduleEntitlementSchema,
  entitlementsResponseSchema,
  createServiceKeySchema,
  serviceKeyResponseSchema,
} from "./index.js";

describe("createTenantSchema", () => {
  it("accepts valid input", () => {
    const result = createTenantSchema.safeParse({
      name: "Demo Corp",
      slug: "demo-corp",
      billingEmail: "billing@demo.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = createTenantSchema.safeParse({
      name: "A",
      slug: "a-corp",
      billingEmail: "billing@demo.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug (uppercase)", () => {
    const result = createTenantSchema.safeParse({
      name: "Demo Corp",
      slug: "Demo-Corp",
      billingEmail: "billing@demo.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createTenantSchema.safeParse({
      name: "Demo Corp",
      slug: "demo-corp",
      billingEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTenantSchema", () => {
  it("accepts partial updates", () => {
    const result = updateTenantSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all optional)", () => {
    const result = updateTenantSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateTenantSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });

  it("accepts valid status values", () => {
    for (const status of ["onboarding", "active", "suspended", "cancelled"]) {
      const result = updateTenantSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

describe("addModuleSchema", () => {
  it("accepts valid module input", () => {
    const result = addModuleSchema.safeParse({
      productId: "safespec",
      moduleId: "safespec-whs",
      maxUsers: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid product", () => {
    const result = addModuleSchema.safeParse({
      productId: "invalid",
      moduleId: "some-module",
    });
    expect(result.success).toBe(false);
  });

  it("defaults maxUsers to 5", () => {
    const result = addModuleSchema.safeParse({
      productId: "nexum",
      moduleId: "nexum-core",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxUsers).toBe(5);
    }
  });

  it("defaults status to active", () => {
    const result = addModuleSchema.safeParse({
      productId: "nexum",
      moduleId: "nexum-core",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("rejects maxUsers <= 0", () => {
    const result = addModuleSchema.safeParse({
      productId: "safespec",
      moduleId: "safespec-whs",
      maxUsers: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateModuleSchema", () => {
  it("accepts status update", () => {
    const result = updateModuleSchema.safeParse({ status: "suspended" });
    expect(result.success).toBe(true);
  });

  it("accepts maxUsers update", () => {
    const result = updateModuleSchema.safeParse({ maxUsers: 25 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateModuleSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });
});

describe("tenantIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = tenantIdParamSchema.safeParse({
      tenantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID", () => {
    const result = tenantIdParamSchema.safeParse({ tenantId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("moduleIdParamSchema", () => {
  it("accepts valid params", () => {
    const result = moduleIdParamSchema.safeParse({
      tenantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      moduleId: "safespec-whs",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty moduleId", () => {
    const result = moduleIdParamSchema.safeParse({
      tenantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      moduleId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("tenantListQuerySchema", () => {
  it("applies defaults", () => {
    const result = tenantListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("coerces string numbers", () => {
    const result = tenantListQuerySchema.safeParse({
      page: "3",
      limit: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit > 100", () => {
    const result = tenantListQuerySchema.safeParse({ limit: "200" });
    expect(result.success).toBe(false);
  });
});

describe("moduleEntitlementSchema", () => {
  it("accepts valid entitlement with plan", () => {
    const result = moduleEntitlementSchema.safeParse({
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
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid entitlement without plan", () => {
    const result = moduleEntitlementSchema.safeParse({
      productId: "nexum",
      moduleId: "nexum-core",
      status: "active",
      maxUsers: 5,
      currentUsers: 1,
      plan: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative currentUsers", () => {
    const result = moduleEntitlementSchema.safeParse({
      productId: "nexum",
      moduleId: "nexum-core",
      status: "active",
      maxUsers: 5,
      currentUsers: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createServiceKeySchema", () => {
  it("accepts safespec", () => {
    const result = createServiceKeySchema.safeParse({ productId: "safespec" });
    expect(result.success).toBe(true);
  });

  it("accepts nexum", () => {
    const result = createServiceKeySchema.safeParse({ productId: "nexum" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid product", () => {
    const result = createServiceKeySchema.safeParse({ productId: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing productId", () => {
    const result = createServiceKeySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("serviceKeyResponseSchema", () => {
  it("accepts valid key response", () => {
    const result = serviceKeyResponseSchema.safeParse({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      productId: "safespec",
      keyPrefix: "abcd1234",
      status: "active",
      createdBy: "user-123",
      lastUsedAt: null,
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts key with lastUsedAt", () => {
    const result = serviceKeyResponseSchema.safeParse({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      productId: "nexum",
      keyPrefix: "ef567890",
      status: "revoked",
      createdBy: "user-456",
      lastUsedAt: "2026-03-15T10:00:00.000Z",
      revokedAt: "2026-03-20T12:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("entitlementsResponseSchema", () => {
  it("accepts full entitlements response", () => {
    const result = entitlementsResponseSchema.safeParse({
      tenantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty modules array", () => {
    const result = entitlementsResponseSchema.safeParse({
      tenantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      tenantStatus: "onboarding",
      modules: [],
    });
    expect(result.success).toBe(true);
  });
});
