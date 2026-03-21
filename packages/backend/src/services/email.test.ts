import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, "../email-templates");

describe("email templates", () => {
  const templateFiles = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".hbs"));

  it("has all required templates", () => {
    const required = [
      "welcome.hbs",
      "payment-received.hbs",
      "payment-failed.hbs",
      "payment-failed-final.hbs",
      "account-suspended.hbs",
      "module-added.hbs",
      "module-removed.hbs",
      "plan-changed.hbs",
      "provisioning-failed.hbs",
      "trial-ending.hbs",
      "trial-expired.hbs",
    ];

    for (const name of required) {
      expect(templateFiles, `Missing template: ${name}`).toContain(name);
    }
  });

  it("all templates compile without errors", () => {
    for (const file of templateFiles) {
      const source = readFileSync(resolve(TEMPLATE_DIR, file), "utf-8");
      expect(() => Handlebars.compile(source), `Template ${file} failed to compile`).not.toThrow();
    }
  });

  it("welcome template renders with all variables", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "welcome.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      userName: "Ryan",
      companyName: "Test Haulage",
      loginUrl: "http://localhost:5170",
      supportEmail: "support@redbay.com.au",
    });

    expect(html).toContain("Ryan");
    expect(html).toContain("Test Haulage");
    expect(html).toContain("http://localhost:5170");
    expect(html).toContain("support@redbay.com.au");
  });

  it("payment-received template renders currency and dates", () => {
    // Register the helpers that the email service uses
    Handlebars.registerHelper("formatCurrency", (cents: number) => {
      return `$${(cents / 100).toFixed(2)}`;
    });
    Handlebars.registerHelper("formatDate", (isoDate: string) => {
      return new Date(isoDate).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    });

    const source = readFileSync(resolve(TEMPLATE_DIR, "payment-received.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Demo Co",
      amountCents: 9900,
      currency: "AUD",
      invoiceUrl: "https://stripe.com/invoice/123",
      periodStart: "2026-03-01T00:00:00Z",
      periodEnd: "2026-04-01T00:00:00Z",
    });

    expect(html).toContain("Demo Co");
    expect(html).toContain("$99.00");
    expect(html).toContain("AUD");
    expect(html).toContain("stripe.com/invoice/123");
  });

  it("payment-failed template renders retry info", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "payment-failed.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Demo Co",
      amountCents: 9900,
      currency: "AUD",
      retryDate: null,
      updatePaymentUrl: "http://localhost:5170/billing",
    });

    expect(html).toContain("Demo Co");
    expect(html).toContain("$99.00");
    expect(html).toContain("http://localhost:5170/billing");
  });

  it("account-suspended template renders reactivation link", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "account-suspended.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Suspended Co",
      reactivateUrl: "http://localhost:5170/reactivate",
      supportEmail: "support@redbay.com.au",
    });

    expect(html).toContain("Suspended Co");
    expect(html).toContain("http://localhost:5170/reactivate");
    expect(html).toContain("read-only");
  });

  it("module-added template renders module and product names", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "module-added.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Test Co",
      moduleName: "safespec-whs",
      productName: "SafeSpec",
      loginUrl: "https://app.safespec.com.au",
    });

    expect(html).toContain("safespec-whs");
    expect(html).toContain("SafeSpec");
    expect(html).toContain("app.safespec.com.au");
  });

  it("module-removed template renders retention period", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "module-removed.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Test Co",
      moduleName: "nexum-invoicing",
      productName: "Nexum",
      retentionDays: 90,
      supportEmail: "support@redbay.com.au",
    });

    expect(html).toContain("nexum-invoicing");
    expect(html).toContain("90 days");
  });

  it("provisioning-failed template renders error and admin link", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "provisioning-failed.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      tenantName: "Failed Tenant",
      productId: "nexum",
      error: "Connection timeout",
      adminUrl: "http://localhost:5170/admin/tenants/123",
    });

    expect(html).toContain("Failed Tenant");
    expect(html).toContain("nexum");
    expect(html).toContain("Connection timeout");
    expect(html).toContain("admin/tenants/123");
  });

  it("trial-ending template renders trial end date and upgrade URL", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "trial-ending.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Trial Co",
      trialEndDate: "2026-03-24T00:00:00Z",
      upgradeUrl: "http://localhost:5170/pricing",
    });

    expect(html).toContain("Trial Co");
    expect(html).toContain("http://localhost:5170/pricing");
    expect(html).toContain("3 days");
  });

  it("trial-expired template renders subscribe URL", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "trial-expired.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Expired Co",
      subscribeUrl: "http://localhost:5170/pricing",
    });

    expect(html).toContain("Expired Co");
    expect(html).toContain("read-only");
    expect(html).toContain("90 days");
    expect(html).toContain("http://localhost:5170/pricing");
  });

  it("payment-failed-final template renders suspension date", () => {
    const source = readFileSync(resolve(TEMPLATE_DIR, "payment-failed-final.hbs"), "utf-8");
    const template = Handlebars.compile(source);
    const html = template({
      companyName: "Failing Co",
      amountCents: 15000,
      currency: "AUD",
      suspensionDate: "2026-03-28T00:00:00Z",
      updatePaymentUrl: "http://localhost:5170/billing",
    });

    expect(html).toContain("Failing Co");
    expect(html).toContain("$150.00");
    expect(html).toContain("AUD");
    expect(html).toContain("suspended");
    expect(html).toContain("http://localhost:5170/billing");
  });

  it("no template uses triple-brace unescaped output", () => {
    for (const file of templateFiles) {
      const source = readFileSync(resolve(TEMPLATE_DIR, file), "utf-8");
      expect(source, `Template ${file} contains triple-brace (XSS risk)`).not.toMatch(/\{\{\{/);
    }
  });
});
