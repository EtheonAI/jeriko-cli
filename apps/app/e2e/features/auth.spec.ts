import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated users are redirected to login", async ({ browser }) => {
    // Create a fresh context without stored auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/chat/test-session");
    await expect(page).toHaveURL(/login/);
    await expect(page.url()).toContain("callbackUrl");

    await context.close();
  });

  test("login page renders correctly", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue|sign in|next/i })
    ).toBeVisible();

    await context.close();
  });

  test("login page has proper metadata", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    const title = await page.title();
    expect(title.toLowerCase()).toContain("rubic");

    await context.close();
  });
});
