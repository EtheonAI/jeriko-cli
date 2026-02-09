import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class SettingsPage extends BasePage {
  readonly dialog: Locator;
  readonly tabList: Locator;
  readonly closeButton: Locator;
  readonly dialogTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.locator(
      "[role='dialog'], [data-testid='settings-dialog']",
    );
    this.tabList = page.locator("[role='tablist']");
    this.closeButton = page.locator(
      "[data-testid='settings-close'], button[aria-label='Close']",
    );
    this.dialogTitle = this.dialog.locator("h2");
  }

  /**
   * Open settings via URL hash, which triggers the SettingsProvider.
   * Falls back to clicking the sidebar settings button.
   */
  async openSettings() {
    // Use hash-based navigation since SettingsContext listens for #settings
    await this.page.evaluate(() => {
      window.location.hash = "#settings";
    });
    await this.dialog.waitFor({ state: "visible", timeout: 5000 });
  }

  /** Open settings directly to a specific tab via hash */
  async openSettingsToTab(tab: string) {
    await this.page.evaluate(
      (t) => {
        window.location.hash = `#settings/${t}`;
      },
      tab.toLowerCase(),
    );
    await this.dialog.waitFor({ state: "visible", timeout: 5000 });
  }

  async selectTab(name: string) {
    // Settings uses button-based navigation, not role="tab"
    const tabButton = this.dialog
      .locator("nav button", { hasText: new RegExp(name, "i") })
      .first();
    await tabButton.click();
  }

  async getVisibleTabNames(): Promise<string[]> {
    const tabs = this.dialog.locator("nav button");
    const count = await tabs.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  async closeSettings() {
    this.closeButton.click();
    await this.dialog.waitFor({ state: "hidden", timeout: 5000 });
  }

  async isDialogVisible(): Promise<boolean> {
    return this.dialog.isVisible().catch(() => false);
  }
}
