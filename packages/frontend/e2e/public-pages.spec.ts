import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("landing page loads with hero and product sections", async ({ page }) => {
    await page.goto("/");

    // Page title / branding
    await expect(page.locator("text=OpShield")).toBeVisible();

    // Hero section should have a call-to-action
    await expect(page.getByRole("link", { name: /get started|sign up|pricing/i })).toBeVisible();
  });

  test("pricing page loads with plan cards", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.locator("h1")).toContainText(/pricing/i);

    // Should have monthly/annual toggle
    await expect(page.locator("text=/monthly|annual/i").first()).toBeVisible();
  });

  test("navigating from landing to pricing", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /pricing/i }).first().click();

    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.locator("h1")).toContainText(/pricing/i);
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/auth/login");

    await expect(page.locator("text=/sign in|log in|email/i").first()).toBeVisible();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("sign-up page is accessible", async ({ page }) => {
    await page.goto("/auth/sign-up");

    await expect(page.locator("text=/create|sign up|register/i").first()).toBeVisible();
  });
});
