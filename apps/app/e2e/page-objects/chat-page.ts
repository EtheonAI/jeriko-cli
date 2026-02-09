import { type Page, type Locator, type FilePayload } from "@playwright/test";
import { BasePage } from "./base-page";

export class ChatPage extends BasePage {
  readonly promptInput: Locator;
  readonly sendButton: Locator;
  readonly fileInput: Locator;
  readonly micButton: Locator;
  readonly messageList: Locator;
  readonly toolCard: Locator;
  readonly toolCompact: Locator;
  readonly plannerBar: Locator;
  readonly canvasPanel: Locator;
  readonly assistantMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.promptInput = page.getByRole("textbox", { name: /send a message/i });
    this.sendButton = page.locator(
      "button[aria-label='Send message']:visible, [data-testid='send-button']:visible"
    );
    this.fileInput = page.locator("input[type='file']").first();
    this.micButton = page
      .getByRole("button", { name: /Voice input|Stop recording/i })
      .first();
    this.messageList = page.locator(
      "[data-testid='message-list'], [role='log']"
    );
    this.toolCard = page.locator("[data-testid='tool-card']");
    this.toolCompact = page.locator("[data-testid='tool-compact']");
    this.plannerBar = page.locator("[data-testid='planner-bar']");
    this.canvasPanel = page.locator("[data-testid='agent-canvas']");
    this.assistantMessage = page.locator("[data-role='assistant']:visible");
  }

  async sendMessage(text: string) {
    const input = this.promptInput.first();
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.click({ force: true });
    await input.press("Meta+A");
    await input.press("Backspace");
    await input.type(text, { delay: 10 });
    await input.press("Enter");
  }

  async uploadFiles(paths: string | string[] | FilePayload | FilePayload[]) {
    const activePromptFileInput = this.promptInput
      .first()
      .locator("xpath=ancestor::label[1]//input[@type='file']")
      .first();
    await activePromptFileInput.setInputFiles(paths);
  }

  async waitForResponse(timeout = 30_000) {
    await this.assistantMessage
      .last()
      .waitFor({ state: "visible", timeout });
  }

  async getLastAssistantMessage() {
    return this.assistantMessage.last().textContent();
  }

  /** Wait for a specific tool card to appear */
  async waitForToolCard(toolName: string, timeout = 15_000) {
    await this.page
      .locator(`[data-testid='tool-card'][data-tool-name='${toolName}']`)
      .first()
      .waitFor({ state: "visible", timeout });
  }

  /** Get count of all visible tool cards */
  async getToolCardCount(): Promise<number> {
    return this.toolCard.count();
  }

  /** Get all tool names from visible tool cards */
  async getToolCardNames(): Promise<string[]> {
    const cards = this.toolCard;
    const count = await cards.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).getAttribute("data-tool-name");
      if (name) names.push(name);
    }
    return names;
  }

  /** Get tool card by tool name */
  toolCardByName(toolName: string): Locator {
    return this.page.locator(
      `[data-testid='tool-card'][data-tool-name='${toolName}']`
    );
  }

  /** Get tool card state attribute */
  async getToolCardState(toolName: string): Promise<string | null> {
    return this.toolCardByName(toolName)
      .first()
      .getAttribute("data-tool-state");
  }

  /** Wait for streaming to complete (no more input-streaming cards) */
  async waitForStream(timeout = 30_000) {
    await this.page.waitForFunction(
      () => {
        return (
          document.querySelectorAll(
            "[data-testid='tool-card'][data-tool-state='input-streaming']"
          ).length === 0
        );
      },
      { timeout }
    );
  }

  /** Get planner progress text */
  async getPlannerProgress(): Promise<string | null> {
    return this.plannerBar.textContent();
  }

  /** Check if canvas panel is visible */
  async isCanvasVisible(): Promise<boolean> {
    return this.canvasPanel.isVisible().catch(() => false);
  }

  /** Wait for canvas to appear and return whether it's visible */
  async waitForCanvas(timeout = 15_000): Promise<boolean> {
    try {
      await this.canvasPanel.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** Get the current canvas view type from data-view-type attribute */
  async getCanvasViewType(): Promise<string | null> {
    return this.canvasPanel.getAttribute("data-view-type");
  }

  /** Rate an assistant message with stars (1-5) */
  async rateMessage(messageIndex: number, stars: number) {
    const message = this.assistantMessage.nth(messageIndex);
    // Hover to reveal action bar
    await message.hover();
    // Click the star button
    const starButton = this.page.locator(
      `button[aria-label="Rate ${stars} star${stars > 1 ? "s" : ""}"]`,
    );
    await starButton.first().click();
  }

  /** Get the current star rating for an assistant message (count filled stars) */
  async getMessageRating(messageIndex: number): Promise<number> {
    const message = this.assistantMessage.nth(messageIndex);
    await message.hover();
    // Count filled stars (text-yellow-500 class with fill="currentColor")
    const filledStars = this.page.locator(
      "button[aria-label*='Rate'] .text-yellow-500, button[aria-label*='Rate'].text-yellow-500",
    );
    return filledStars.count();
  }

  /** Get star buttons locator */
  starButtons(): import("@playwright/test").Locator {
    return this.page.locator("button[aria-label*='Rate']");
  }
}
