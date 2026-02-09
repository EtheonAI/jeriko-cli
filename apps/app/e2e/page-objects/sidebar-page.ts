import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class SidebarPage extends BasePage {
  readonly sidebarRoot: Locator;
  readonly logo: Locator;
  readonly newTaskButton: Locator;
  readonly searchButton: Locator;
  readonly navSection: Locator;
  readonly chatItemsList: Locator;
  readonly chatItem: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    super(page);
    this.sidebarRoot = page
      .locator("[data-testid='sidebar'], aside")
      .first();
    this.logo = this.sidebarRoot.locator(
      "text=Rubic, [data-testid='sidebar-logo']",
    );
    this.newTaskButton = this.sidebarRoot
      .getByRole("button", { name: /new|task/i })
      .first();
    this.searchButton = this.sidebarRoot
      .getByRole("button", { name: /search/i })
      .first();
    this.navSection = this.sidebarRoot.locator(
      "[data-testid='nav-section'], nav",
    );
    this.chatItemsList = this.sidebarRoot.locator(
      "[data-testid='chat-items'], [role='list']",
    );
    this.chatItem = this.sidebarRoot.locator(
      "[data-testid='chat-item'], li a[href*='/chat/']",
    );
    this.settingsButton = this.sidebarRoot.locator(
      "button:has(svg), [data-testid='settings-button']",
    );
  }

  async getNavLinks(): Promise<{ text: string; href: string }[]> {
    const links = this.sidebarRoot.locator("a[href]");
    const count = await links.count();
    const result: { text: string; href: string }[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await links.nth(i).textContent()) ?? "";
      const href = (await links.nth(i).getAttribute("href")) ?? "";
      if (text.trim() && href) {
        result.push({ text: text.trim(), href });
      }
    }
    return result;
  }

  async hasNavLinkTo(path: string): Promise<boolean> {
    const links = await this.getNavLinks();
    return links.some((link) => link.href === path);
  }

  async getChatItemCount(): Promise<number> {
    return this.chatItem.count();
  }

  async clickNavLink(path: string) {
    const link = this.sidebarRoot.locator(`a[href='${path}']`).first();
    await link.click();
  }

  async isSidebarVisible(): Promise<boolean> {
    return this.sidebarRoot.isVisible().catch(() => false);
  }
}
