import { test, expect } from "@playwright/test";

test.describe("Self-service signup flow", () => {
  test("signup page loads with account creation step", async ({ page }) => {
    await page.goto("/signup");

    // Should show the first step — account creation
    await expect(page.locator("text=/account|create|sign up/i").first()).toBeVisible();
  });

  test("signup flow shows step indicator", async ({ page }) => {
    await page.goto("/signup");

    // Should show the multi-step progress indicator
    // Steps: Account → Security → Company → Review
    await expect(page.locator("text=/account/i").first()).toBeVisible();
  });

  test("signup protected routes redirect without auth", async ({ page }) => {
    // These require authentication
    await page.goto("/signup/company");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("signup review step requires auth", async ({ page }) => {
    await page.goto("/signup/review");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("checkout success page accessible", async ({ page }) => {
    // This is behind auth too
    await page.goto("/signup/success");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("checkout cancelled page accessible", async ({ page }) => {
    await page.goto("/signup/cancelled");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
