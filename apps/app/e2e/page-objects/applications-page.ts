import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class ApplicationsPage extends BasePage {
  readonly connectorCard: Locator;
  readonly categoryFilter: Locator;
  readonly searchInput: Locator;
  readonly connectButton: Locator;
  readonly configPanel: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.connectorCard = page.locator("[data-testid='connector-card']");
    this.categoryFilter = page.locator(
      "[data-testid='category-filter'], button[role='tab']",
    );
    this.searchInput = page.locator(
      "input[placeholder*='Search'], [data-testid='app-search']",
    );
    this.connectButton = page.getByRole("button", { name: /connect/i });
    this.configPanel = page.locator("[data-testid='config-panel']");
    this.pageTitle = page.locator("h1, [data-testid='page-title']");
  }

  async getConnectorCount(): Promise<number> {
    return this.connectorCard.count();
  }

  async filterByCategory(category: string) {
    await this.page
      .getByRole("tab", { name: new RegExp(category, "i") })
      .click();
  }

  async searchConnectors(query: string) {
    await this.searchInput.fill(query);
  }

  async waitForConnectorCards(timeout = 10_000) {
    await this.connectorCard
      .first()
      .waitFor({ state: "visible", timeout })
      .catch(() => {
        /* marketplace may be empty */
      });
  }

  async getConnectorCardNames(): Promise<string[]> {
    const count = await this.connectorCard.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await this.connectorCard.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }
}
