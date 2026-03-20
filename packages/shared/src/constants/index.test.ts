import { describe, it, expect } from "vitest";
import { PRODUCTS, SAFESPEC_MODULES, NEXUM_MODULES } from "./index.js";

describe("constants", () => {
  it("defines both products", () => {
    expect(PRODUCTS.NEXUM).toBe("nexum");
    expect(PRODUCTS.SAFESPEC).toBe("safespec");
  });

  it("defines SafeSpec modules", () => {
    expect(SAFESPEC_MODULES.WHS).toBe("safespec-whs");
    expect(SAFESPEC_MODULES.HVA).toBe("safespec-hva");
  });

  it("defines Nexum core module", () => {
    expect(NEXUM_MODULES.CORE).toBe("nexum-core");
  });
});
