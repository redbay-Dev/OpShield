import { describe, it, expect } from "vitest";
import {
  provisioningStatusValues,
  provisionTenantRequestSchema,
  provisioningCallbackSchema,
  retryProvisioningSchema,
} from "@opshield/shared/schemas";

describe("provisioning schemas", () => {
  describe("provisioningStatusValues", () => {
    it("contains all expected status values", () => {
      expect(provisioningStatusValues).toEqual([
        "pending",
        "dispatched",
        "success",
        "failed",
      ]);
    });
  });

  describe("provisionTenantRequestSchema", () => {
    it("accepts empty object", () => {
      const result = provisionTenantRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts full owner info", () => {
      const result = provisionTenantRequestSchema.safeParse({
        ownerUserId: "user-123",
        ownerEmail: "owner@example.com",
        ownerName: "Jane Doe",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = provisionTenantRequestSchema.safeParse({
        ownerEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("provisioningCallbackSchema", () => {
    it("accepts valid success callback", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "nexum",
        success: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid failure callback with error", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "safespec",
        success: false,
        error: "Migration failed",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid productId", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "invalid",
        success: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing success field", () => {
      const result = provisioningCallbackSchema.safeParse({
        productId: "nexum",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("retryProvisioningSchema", () => {
    it("accepts valid productId", () => {
      const result = retryProvisioningSchema.safeParse({ productId: "nexum" });
      expect(result.success).toBe(true);
    });

    it("accepts safespec", () => {
      const result = retryProvisioningSchema.safeParse({
        productId: "safespec",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid productId", () => {
      const result = retryProvisioningSchema.safeParse({
        productId: "unknown",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing productId", () => {
      const result = retryProvisioningSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
