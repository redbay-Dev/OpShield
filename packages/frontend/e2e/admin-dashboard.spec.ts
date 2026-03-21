import { test, expect } from "@playwright/test";

test.describe("Admin dashboard (requires auth)", () => {
  test("admin page redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("tenant list page requires auth", async ({ page }) => {
    await page.goto("/admin/tenants");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("webhook log page requires auth", async ({ page }) => {
    await page.goto("/admin/webhook-log");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("audit log page requires auth", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("system health page requires auth", async ({ page }) => {
    await page.goto("/admin/system-health");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("revenue page requires auth", async ({ page }) => {
    await page.goto("/admin/revenue");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
