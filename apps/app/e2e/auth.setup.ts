import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");
  await expect(page).toHaveURL(/login/);

  // Fill in credentials — uses E2E test account
  const email = process.env.E2E_USER_EMAIL ?? "test@rubic.dev";
  const password = process.env.E2E_USER_PASSWORD ?? "test-password-123";

  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: /continue|next|sign in/i }).click();

  // If password page is separate
  const passwordInput = page.getByLabel(/password/i);
  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordInput.fill(password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
  }

  // Wait for redirect to dashboard (authenticated area)
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.locator("body")).toBeVisible();

  // Save auth state for reuse across test projects
  await page.context().storageState({ path: AUTH_FILE });
});
