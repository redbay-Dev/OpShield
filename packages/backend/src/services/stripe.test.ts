import { describe, it, expect } from "vitest";
import { constructWebhookEvent } from "./stripe.js";

describe("stripe service", () => {
  describe("constructWebhookEvent", () => {
    it("throws on invalid signature", () => {
      const rawBody = Buffer.from(JSON.stringify({ type: "test" }));
      expect(() =>
        constructWebhookEvent(rawBody, "t=1234,v1=invalid"),
      ).toThrow();
    });

    it("throws on empty body", () => {
      expect(() =>
        constructWebhookEvent(Buffer.from(""), "t=1234,v1=invalid"),
      ).toThrow();
    });
  });
});
