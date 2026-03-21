import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  test("login page shows email and password fields", async ({ page }) => {
    await page.goto("/auth/login");

    // Should have email input
    const emailInput = page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]'));
    await expect(emailInput).toBeVisible();

    // Should have password input
    const passwordInput = page.getByPlaceholder(/password/i).or(page.locator('input[type="password"]'));
    await expect(passwordInput).toBeVisible();

    // Should have a submit button
    await expect(page.getByRole("button", { name: /sign in|log in|submit/i })).toBeVisible();
  });

  test("login page has link to sign up", async ({ page }) => {
    await page.goto("/auth/login");

    const signUpLink = page.getByRole("link", { name: /sign up|create account|register/i });
    await expect(signUpLink).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/auth/login");

    const emailInput = page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]'));
    const passwordInput = page.getByPlaceholder(/password/i).or(page.locator('input[type="password"]'));

    await emailInput.fill("nonexistent@example.com");
    await passwordInput.fill("wrongpassword123");

    await page.getByRole("button", { name: /sign in|log in|submit/i }).click();

    // Should show an error (either inline or toast)
    await expect(
      page.locator("text=/invalid|incorrect|failed|error/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user redirected from admin", async ({ page }) => {
    await page.goto("/admin");

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user redirected from account", async ({ page }) => {
    await page.goto("/account");

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("sign-up page has required fields", async ({ page }) => {
    await page.goto("/auth/sign-up");

    // Should have name, email, password fields
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("2FA verify page accessible", async ({ page }) => {
    await page.goto("/auth/2fa-verify");

    // Should show 2FA verification form or redirect
    // (redirects to login if no pending 2FA session)
    await page.waitForURL(/\/(auth\/2fa-verify|auth\/login)/);
  });
});
