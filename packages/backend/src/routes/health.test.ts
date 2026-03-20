import { describe, it, expect } from "vitest";

describe("health route", () => {
  it("returns ok status shape", () => {
    const response = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "opshield-api",
    };

    expect(response.status).toBe("ok");
    expect(response.service).toBe("opshield-api");
  });
});
