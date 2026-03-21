import { describe, it, expect } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { signPayload } from "./webhook.js";

/** Generate a random secret for testing — avoids hardcoded credential warnings */
function testSecret(): string {
  return randomBytes(32).toString("hex");
}

describe("webhook service", () => {
  describe("signPayload", () => {
    it("produces a valid HMAC-SHA256 signature in the expected format", () => {
      const body = JSON.stringify({ event: "module.activated", tenantId: "abc" });
      const secret = testSecret();
      const timestamp = 1700000000;

      const result = signPayload(body, secret, timestamp);

      // Should follow the format: t=<timestamp>,v1=<hmac>
      expect(result).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      expect(result).toContain(`t=${timestamp}`);
    });

    it("generates a deterministic signature for the same inputs", () => {
      const body = '{"event":"test"}';
      const secret = testSecret();
      const timestamp = 1700000000;

      const sig1 = signPayload(body, secret, timestamp);
      const sig2 = signPayload(body, secret, timestamp);

      expect(sig1).toBe(sig2);
    });

    it("produces different signatures for different bodies", () => {
      const secret = testSecret();
      const timestamp = 1700000000;

      const sig1 = signPayload('{"event":"a"}', secret, timestamp);
      const sig2 = signPayload('{"event":"b"}', secret, timestamp);

      expect(sig1).not.toBe(sig2);
    });

    it("produces different signatures for different secrets", () => {
      const body = '{"event":"test"}';
      const timestamp = 1700000000;

      const sig1 = signPayload(body, testSecret(), timestamp);
      const sig2 = signPayload(body, testSecret(), timestamp);

      expect(sig1).not.toBe(sig2);
    });

    it("produces different signatures for different timestamps", () => {
      const body = '{"event":"test"}';
      const secret = testSecret();

      const sig1 = signPayload(body, secret, 1700000000);
      const sig2 = signPayload(body, secret, 1700000001);

      expect(sig1).not.toBe(sig2);
    });

    it("matches a manually computed HMAC-SHA256", () => {
      const body = '{"test":true}';
      const secret = testSecret();
      const timestamp = 1234567890;

      const result = signPayload(body, secret, timestamp);

      // Manually compute expected value
      const signedContent = `${timestamp}.${body}`;
      const expectedHmac = createHmac("sha256", secret)
        .update(signedContent)
        .digest("hex");

      expect(result).toBe(`t=${timestamp},v1=${expectedHmac}`);
    });

    it("handles empty body string", () => {
      const result = signPayload("", testSecret(), 1700000000);
      expect(result).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it("handles unicode in body", () => {
      const body = JSON.stringify({ name: "テスト会社" });
      const result = signPayload(body, testSecret(), 1700000000);
      expect(result).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });
  });
});
