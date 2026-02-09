import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class DevicesPage extends BasePage {
  readonly catalogGrid: Locator;
  readonly myDevicesTab: Locator;
  readonly smartHomeTab: Locator;
  readonly hubsTab: Locator;
  readonly deviceCard: Locator;
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.catalogGrid = page.locator(
      "[data-testid='device-catalog'], [role='grid']",
    );
    this.myDevicesTab = page.getByRole("tab", { name: /my devices/i });
    this.smartHomeTab = page.getByRole("tab", { name: /smart home/i });
    this.hubsTab = page.getByRole("tab", { name: /hubs/i });
    this.deviceCard = page.locator("[data-testid='device-card']");
    this.searchInput = page.locator(
      "input[placeholder*='Search'], [data-testid='device-search']",
    );
    this.categoryFilter = page.locator("[data-testid='category-filter']");
    this.pageTitle = page.locator("h1, [data-testid='page-title']");
  }

  async getDeviceCount(): Promise<number> {
    return this.deviceCard.count();
  }

  async selectTab(name: string) {
    await this.page
      .getByRole("tab", { name: new RegExp(name, "i") })
      .click();
  }

  async searchDevices(query: string) {
    await this.searchInput.fill(query);
  }

  async waitForDeviceCards(timeout = 10_000) {
    await this.deviceCard
      .first()
      .waitFor({ state: "visible", timeout })
      .catch(() => {
        /* grid may be empty */
      });
  }

  async getDeviceCardNames(): Promise<string[]> {
    const count = await this.deviceCard.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await this.deviceCard.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }
}
