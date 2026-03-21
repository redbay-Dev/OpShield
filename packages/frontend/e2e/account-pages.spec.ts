import { test, expect } from "@playwright/test";

test.describe("Account self-service pages (requires auth)", () => {
  test("account overview redirects to login without auth", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("profile page redirects to login without auth", async ({ page }) => {
    await page.goto("/account/profile");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("billing page redirects to login without auth", async ({ page }) => {
    await page.goto("/account/billing");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("notifications page redirects to login without auth", async ({ page }) => {
    await page.goto("/account/notifications");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
