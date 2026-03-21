import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  updateTenantSchema,
  addModuleSchema,
  updateModuleSchema,
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  usageReportSchema,
  provisioningCallbackSchema,
  retryProvisioningSchema,
  auditLogQuerySchema,
  upsertSsoProviderSchema,
  tenantIdParamSchema,
  moduleIdParamSchema,
  webhookDeliveryQuerySchema,
} from "./index.js";

describe("tenant schemas", () => {
  describe("createTenantSchema", () => {
    it("accepts valid input", () => {
      const result = createTenantSchema.safeParse({
        name: "Test Haulage Pty Ltd",
        slug: "test-haulage",
        billingEmail: "billing@test.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects name too short", () => {
      const result = createTenantSchema.safeParse({
        name: "T",
        slug: "test-haulage",
        billingEmail: "billing@test.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid slug characters", () => {
      const result = createTenantSchema.safeParse({
        name: "Test Haulage",
        slug: "Test Haulage!",
        billingEmail: "billing@test.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = createTenantSchema.safeParse({
        name: "Test Haulage",
        slug: "test-haulage",
        billingEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateTenantSchema", () => {
    it("accepts partial updates", () => {
      expect(updateTenantSchema.safeParse({ name: "New Name" }).success).toBe(true);
      expect(updateTenantSchema.safeParse({ status: "active" }).success).toBe(true);
      expect(updateTenantSchema.safeParse({}).success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = updateTenantSchema.safeParse({ status: "deleted" });
      expect(result.success).toBe(false);
    });

    it("accepts all valid statuses", () => {
      for (const status of ["onboarding", "active", "suspended", "cancelled"]) {
        expect(updateTenantSchema.safeParse({ status }).success).toBe(true);
      }
    });
  });
});

describe("module schemas", () => {
  describe("addModuleSchema", () => {
    it("accepts valid safespec module", () => {
      const result = addModuleSchema.safeParse({
        productId: "safespec",
        moduleId: "safespec-whs",
        maxUsers: 10,
        status: "active",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid nexum module with defaults", () => {
      const result = addModuleSchema.safeParse({
        productId: "nexum",
        moduleId: "nexum-core",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxUsers).toBe(5);
        expect(result.data.status).toBe("active");
      }
    });

    it("rejects invalid product", () => {
      const result = addModuleSchema.safeParse({
        productId: "unknown",
        moduleId: "something",
      });
      expect(result.success).toBe(false);
    });

    it("rejects zero maxUsers", () => {
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
      expect(updateModuleSchema.safeParse({ status: "suspended" }).success).toBe(true);
    });

    it("accepts maxUsers update", () => {
      expect(updateModuleSchema.safeParse({ maxUsers: 20 }).success).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(updateModuleSchema.safeParse({ status: "deleted" }).success).toBe(false);
    });
  });
});

describe("billing schemas", () => {
  describe("createSubscriptionSchema", () => {
    it("accepts monthly billing", () => {
      const result = createSubscriptionSchema.safeParse({ billingInterval: "monthly" });
      expect(result.success).toBe(true);
    });

    it("accepts annual billing with trial", () => {
      const result = createSubscriptionSchema.safeParse({
        billingInterval: "annual",
        trialPeriodDays: 14,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid interval", () => {
      expect(createSubscriptionSchema.safeParse({ billingInterval: "weekly" }).success).toBe(false);
    });

    it("rejects trial over 90 days", () => {
      const result = createSubscriptionSchema.safeParse({
        billingInterval: "monthly",
        trialPeriodDays: 91,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("cancelSubscriptionSchema", () => {
    it("defaults atPeriodEnd to true", () => {
      const result = cancelSubscriptionSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.atPeriodEnd).toBe(true);
      }
    });

    it("accepts explicit false", () => {
      const result = cancelSubscriptionSchema.safeParse({ atPeriodEnd: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.atPeriodEnd).toBe(false);
      }
    });
  });
});

describe("usage and provisioning schemas", () => {
  describe("usageReportSchema", () => {
    it("accepts valid usage report", () => {
      const result = usageReportSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000000",
        productId: "safespec",
        moduleId: "safespec-whs",
        metric: "user_count",
        value: 15,
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-user_count metric", () => {
      const result = usageReportSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000000",
        productId: "nexum",
        moduleId: "nexum-core",
        metric: "api_calls",
        value: 100,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative value", () => {
      const result = usageReportSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000000",
        productId: "nexum",
        moduleId: "nexum-core",
        metric: "user_count",
        value: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("provisioningCallbackSchema", () => {
    it("accepts success callback", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "safespec",
        success: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts failure callback with error", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "nexum",
        success: false,
        error: "Schema creation failed",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown product", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "unknown",
        success: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("retryProvisioningSchema", () => {
    it("accepts valid product", () => {
      expect(retryProvisioningSchema.safeParse({ productId: "safespec" }).success).toBe(true);
      expect(retryProvisioningSchema.safeParse({ productId: "nexum" }).success).toBe(true);
    });
  });
});

describe("audit log schemas", () => {
  describe("auditLogQuerySchema", () => {
    it("provides defaults for pagination", () => {
      const result = auditLogQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it("accepts all filter params", () => {
      const result = auditLogQuerySchema.safeParse({
        page: "2",
        limit: "25",
        action: "tenant.created",
        resourceType: "tenant",
        actorId: "user-123",
        resourceId: "00000000-0000-0000-0000-000000000000",
        from: "2026-01-01T00:00:00Z",
        to: "2026-12-31T23:59:59Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects limit over 100", () => {
      const result = auditLogQuerySchema.safeParse({ limit: "101" });
      expect(result.success).toBe(false);
    });
  });
});

describe("SSO provider schemas", () => {
  describe("upsertSsoProviderSchema", () => {
    it("accepts valid Microsoft SSO config", () => {
      const result = upsertSsoProviderSchema.safeParse({
        provider: "microsoft",
        clientId: "00000000-0000-0000-0000-000000000000",
        clientSecret: "super-secret-value",
        tenantIdAzure: "00000000-0000-0000-0000-000000000001",
        enforced: true,
      });
      expect(result.success).toBe(true);
    });

    it("defaults enforced to false", () => {
      const result = upsertSsoProviderSchema.safeParse({
        provider: "microsoft",
        clientId: "test",
        clientSecret: "test",
        tenantIdAzure: "test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enforced).toBe(false);
      }
    });

    it("rejects non-microsoft provider", () => {
      const result = upsertSsoProviderSchema.safeParse({
        provider: "google",
        clientId: "test",
        clientSecret: "test",
        tenantIdAzure: "test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty clientId", () => {
      const result = upsertSsoProviderSchema.safeParse({
        provider: "microsoft",
        clientId: "",
        clientSecret: "test",
        tenantIdAzure: "test",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("param schemas", () => {
  describe("tenantIdParamSchema", () => {
    it("accepts valid UUID", () => {
      const result = tenantIdParamSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000000",
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
        tenantId: "00000000-0000-0000-0000-000000000000",
        moduleId: "safespec-whs",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("webhookDeliveryQuerySchema", () => {
    it("provides defaults", () => {
      const result = webhookDeliveryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("accepts status filter", () => {
      const result = webhookDeliveryQuerySchema.safeParse({ status: "success" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = webhookDeliveryQuerySchema.safeParse({ status: "pending" });
      expect(result.success).toBe(false);
    });
  });
});

describe("admin role constants", () => {
  it("has correct role permissions", async () => {
    const { ADMIN_ROLE_PERMISSIONS } = await import("@opshield/shared/constants");

    expect(ADMIN_ROLE_PERMISSIONS.super_admin.delete).toBe(true);
    expect(ADMIN_ROLE_PERMISSIONS.support.delete).toBe(false);
    expect(ADMIN_ROLE_PERMISSIONS.support.create).toBe(true);
    expect(ADMIN_ROLE_PERMISSIONS.viewer.create).toBe(false);
    expect(ADMIN_ROLE_PERMISSIONS.viewer.read).toBe(true);
  });
});
