import type { Page, Locator } from "@playwright/test";

export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly header: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator("[data-testid='sidebar'], aside").first();
    this.header = page.locator("header").first();
  }

  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async getSidebarLink(name: string) {
    return this.sidebar.getByRole("link", { name: new RegExp(name, "i") });
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
  }
}
