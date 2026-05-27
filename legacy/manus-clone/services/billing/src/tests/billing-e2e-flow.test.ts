/**
 * Billing E2E Flow Tests
 *
 * Tests the complete credit lifecycle:
 *   1. Credit check before session
 *   2. Step metering (LLM token usage)
 *   3. Tool metering (per-tool costs)
 *   4. VM time metering (sandbox duration)
 *   5. Parallel subtask metering
 *   6. Credit deduction with consumption order (daily → monthly → purchased → starter)
 *   7. Daily credit refresh
 *   8. Plan limit enforcement
 *   9. Balance goes to zero → hard_block
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkCredits,
  meterStepFinish,
  meterToolCall,
  meterVmTime,
  VM_CREDITS_PER_MINUTE,
  refreshDailyCreditsIfNeeded,
  initializeUserCredits,
  getUserPlanLimits,
  recordMeteringEvent,
} from "../lib/metering.js";
import {
  calculateStepCredits,
  getToolCreditCost,
  calculateCreditDeductions,
  PLAN_DEFINITIONS,
  TOOL_CREDIT_COSTS,
  FREE_PLAN_LIMITS,
} from "../lib/plans.js";

// ─── DB Mock ──────────────────────────────────────────────────────────────────

// Track all DB operations for verification
let dbOps: Array<{ op: string; table?: string; data?: unknown }> = [];

const defaultBalance = {
  id: "bal-1",
  userId: "user-e2e",
  balance: 1300,
  dailyCredits: 300,
  dailyCreditsUsed: 0,
  dailyRefreshAmount: 300,
  lastDailyRefreshAt: new Date(),
  periodCredits: 0,
  periodCreditsUsed: 0,
  purchasedCredits: 0,
  purchasedCreditsUsed: 0,
  starterCredits: 1000,
  starterCreditsUsed: 0,
};

function makeDefaultBalance(overrides: Partial<typeof defaultBalance> = {}) {
  return { ...defaultBalance, ...overrides };
}

let balanceState = makeDefaultBalance();

const mockTx = {
  select: vi.fn(() => mockSelect),
  update: vi.fn(() => mockUpdate),
  insert: vi.fn(() => mockInsert),
};

const mockSelect = {
  from: vi.fn(() => mockSelect),
  where: vi.fn(() => mockSelect),
  limit: vi.fn(() => Promise.resolve([])),
};

const mockUpdate = {
  set: vi.fn(() => mockUpdate),
  where: vi.fn(() => mockUpdate),
  returning: vi.fn(() => Promise.resolve([])),
};

const mockInsert = {
  values: vi.fn(() => mockInsert),
  returning: vi.fn(() => Promise.resolve([])),
};

vi.mock("../lib/db.js", () => ({
  db: {
    transaction: vi.fn((callback: (tx: unknown) => Promise<void>) => callback(mockTx)),
    select: vi.fn(() => mockSelect),
    update: vi.fn(() => mockUpdate),
    insert: vi.fn(() => mockInsert),
  },
  creditBalances: {
    id: "id",
    balance: "balance",
    periodCreditsUsed: "periodCreditsUsed",
    dailyCreditsUsed: "dailyCreditsUsed",
    purchasedCreditsUsed: "purchasedCreditsUsed",
    starterCreditsUsed: "starterCreditsUsed",
    userId: "userId",
    dailyCredits: "dailyCredits",
    periodCredits: "periodCredits",
    purchasedCredits: "purchasedCredits",
    starterCredits: "starterCredits",
    dailyRefreshAmount: "dailyRefreshAmount",
    lastDailyRefreshAt: "lastDailyRefreshAt",
  },
  usageLedger: {},
  creditTransactions: {},
  usageRecords: {},
  userSubscriptions: { userId: "userId", status: "status", planId: "planId" },
  subscriptionPlans: { id: "id" },
  eq: vi.fn((_field: unknown, _value: unknown) => ({ type: "eq" })),
  and: vi.fn((..._args: unknown[]) => ({ type: "and" })),
  sql: vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: "sql" })),
}));

vi.mock("@repo/service-utils", () => ({
  createId: vi.fn(() => "test-id-" + Math.random().toString(36).substring(7)),
  dispatchWebhookEvent: vi.fn(),
}));

describe("Billing E2E Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbOps = [];
    balanceState = makeDefaultBalance();

    // Reset and re-establish mock chain (clearAllMocks doesn't clear mockResolvedValueOnce queues)
    mockSelect.from.mockReturnValue(mockSelect);
    mockSelect.where.mockReturnValue(mockSelect);
    mockSelect.limit.mockReset().mockResolvedValue([]);
    mockUpdate.set.mockReturnValue(mockUpdate);
    mockUpdate.where.mockReturnValue(mockUpdate);
    mockUpdate.returning.mockReset().mockResolvedValue([]);
    mockInsert.values.mockReturnValue(mockInsert);
    mockInsert.returning.mockReset().mockResolvedValue([]);
    mockTx.select.mockReturnValue(mockSelect);
    mockTx.update.mockReturnValue(mockUpdate);
    mockTx.insert.mockReturnValue(mockInsert);
  });

  describe("Complete Session Flow", () => {
    it("should handle a full session: check → step × N → tool × N → destroy", async () => {
      // ── Step 1: Credit check before session ──
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()]) // refreshDailyCreditsIfNeeded
        .mockResolvedValueOnce([makeDefaultBalance()]); // checkCredits select

      const check = await checkCredits("user-e2e", 10);
      expect(check.hasCredits).toBe(true);
      expect(check.state).toBe("ok");
      expect(check.currentBalance).toBe(1300);

      // ── Step 2: Agent runs 3 LLM steps ──
      for (let i = 0; i < 3; i++) {
        vi.mocked(mockSelect.limit)
          .mockResolvedValueOnce([makeDefaultBalance()]) // refreshDailyCreditsIfNeeded
          .mockResolvedValueOnce([makeDefaultBalance()]); // tx.select in recordMeteringEvent
        vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1296 }]);

        await meterStepFinish({
          userId: "user-e2e",
          sessionId: "session-e2e",
          stepId: `step-${i}`,
          inputTokens: 2000,  // 2 credits
          outputTokens: 500,  // 2 credits (ceil(500/1000)*3 = 3)
          model: "claude-sonnet-4-5",
        });
      }

      // Verify 3 step metering calls → 3 transactions, each with 3 inserts
      const txCalls = vi.mocked((await import("../lib/db.js")).db.transaction).mock.calls;
      expect(txCalls.length).toBe(3);

      // ── Step 3: Agent uses tools ──
      vi.clearAllMocks();

      // web_search (5 credits)
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()])
        .mockResolvedValueOnce([makeDefaultBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1281 }]);
      await meterToolCall({ userId: "user-e2e", sessionId: "session-e2e", toolName: "web_search" });

      // file_write (1 credit)
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()])
        .mockResolvedValueOnce([makeDefaultBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1280 }]);
      await meterToolCall({ userId: "user-e2e", sessionId: "session-e2e", toolName: "file_write" });

      // show_plan (0 credits — should be skipped)
      await meterToolCall({ userId: "user-e2e", sessionId: "session-e2e", toolName: "show_plan" });

      // image_generation (10 credits)
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()])
        .mockResolvedValueOnce([makeDefaultBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1270 }]);
      await meterToolCall({ userId: "user-e2e", sessionId: "session-e2e", toolName: "image_generation" });

      // 3 tool calls metered (show_plan skipped) = 3 transactions
      const toolTxCalls = vi.mocked((await import("../lib/db.js")).db.transaction).mock.calls;
      expect(toolTxCalls.length).toBe(3);
    });
  });

  describe("VM Time Metering", () => {
    it("should charge 2 credits per minute of sandbox time", async () => {
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()])
        .mockResolvedValueOnce([makeDefaultBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1280 }]);

      await meterVmTime({
        userId: "user-e2e",
        sessionId: "session-e2e",
        sandboxId: "sandbox-123",
        durationMinutes: 5.2, // 6 minutes (ceil) × 2 = 12 credits
      });

      expect(mockInsert.values).toHaveBeenCalled();
      // Verify the ledger entry includes sandbox metadata
      const insertCalls = vi.mocked(mockInsert.values).mock.calls;
      const vmEntry = insertCalls.find(
        (call) => (call[0] as Record<string, unknown>).eventType === "vm_time",
      );
      expect(vmEntry).toBeDefined();
    });

    it("should skip metering for zero-duration sandboxes", async () => {
      await meterVmTime({
        userId: "user-e2e",
        sessionId: "session-e2e",
        sandboxId: "sandbox-123",
        durationMinutes: 0,
      });

      // No DB operations for zero duration
      expect(mockInsert.values).not.toHaveBeenCalled();
    });

    it("should correctly calculate VM credits", () => {
      expect(VM_CREDITS_PER_MINUTE).toBe(2);

      // 1 minute = 2 credits
      // 5.2 minutes = ceil(5.2) * 2 = 12 credits
      // 10 minutes = 20 credits
      // 30 minutes = 60 credits
      expect(Math.ceil(1) * VM_CREDITS_PER_MINUTE).toBe(2);
      expect(Math.ceil(5.2) * VM_CREDITS_PER_MINUTE).toBe(12);
      expect(Math.ceil(10) * VM_CREDITS_PER_MINUTE).toBe(20);
      expect(Math.ceil(30) * VM_CREDITS_PER_MINUTE).toBe(60);
    });
  });

  describe("Parallel Subtask Metering", () => {
    it("should meter each subtask LLM call independently", async () => {
      // Simulate 3 parallel subtask completions being metered
      for (let i = 0; i < 3; i++) {
        vi.mocked(mockSelect.limit)
          .mockResolvedValueOnce([makeDefaultBalance()])
          .mockResolvedValueOnce([makeDefaultBalance()]);
        vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1296 }]);

        await meterStepFinish({
          userId: "user-e2e",
          sessionId: "session-e2e",
          stepId: `subtask_task-${i}`,
          inputTokens: 500,
          outputTokens: 200,
          model: "gpt-4.1-mini",
          metadata: { source: "parallel_tasks" },
        });
      }

      // Each subtask should generate its own transaction
      const txCalls = vi.mocked((await import("../lib/db.js")).db.transaction).mock.calls;
      expect(txCalls.length).toBe(3);
    });

    it("should meter image generation from parallel subtasks", async () => {
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeDefaultBalance()])
        .mockResolvedValueOnce([makeDefaultBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1290 }]);

      await meterToolCall({
        userId: "user-e2e",
        sessionId: "session-e2e",
        toolName: "image_generation",
        metadata: { subtaskId: "task-img-1", model: "dall-e-3", source: "parallel_tasks" },
      });

      expect(getToolCreditCost("image_generation")).toBe(10);
      expect(mockInsert.values).toHaveBeenCalled();
    });
  });

  describe("Credit Consumption Order", () => {
    it("should deduct daily → monthly → purchased → starter", () => {
      const balance = {
        dailyCredits: 100,
        dailyCreditsUsed: 0,
        periodCredits: 200,
        periodCreditsUsed: 0,
        purchasedCredits: 300,
        purchasedCreditsUsed: 0,
        starterCredits: 400,
        starterCreditsUsed: 0,
      };

      // Request 550 credits → should use 100 daily + 200 monthly + 250 purchased
      const deductions = calculateCreditDeductions(550, balance);

      expect(deductions).toEqual([
        { source: "daily", amount: 100 },
        { source: "monthly", amount: 200 },
        { source: "purchased", amount: 250 },
      ]);
    });

    it("should use all sources when needed", () => {
      const balance = {
        dailyCredits: 10,
        dailyCreditsUsed: 0,
        periodCredits: 20,
        periodCreditsUsed: 0,
        purchasedCredits: 30,
        purchasedCreditsUsed: 0,
        starterCredits: 40,
        starterCreditsUsed: 0,
      };

      // Request 100 credits (total available = 100)
      const deductions = calculateCreditDeductions(100, balance);

      expect(deductions).toEqual([
        { source: "daily", amount: 10 },
        { source: "monthly", amount: 20 },
        { source: "purchased", amount: 30 },
        { source: "starter", amount: 40 },
      ]);
    });

    it("should skip already-used credit sources", () => {
      const balance = {
        dailyCredits: 300,
        dailyCreditsUsed: 300, // Fully used
        periodCredits: 3900,
        periodCreditsUsed: 0,
        purchasedCredits: 0,
        purchasedCreditsUsed: 0,
        starterCredits: 1000,
        starterCreditsUsed: 0,
      };

      const deductions = calculateCreditDeductions(50, balance);

      // Should skip daily (used up), go straight to monthly
      expect(deductions).toEqual([{ source: "monthly", amount: 50 }]);
    });

    it("should handle partial daily usage", () => {
      const balance = {
        dailyCredits: 300,
        dailyCreditsUsed: 280, // 20 remaining
        periodCredits: 0,
        periodCreditsUsed: 0,
        purchasedCredits: 0,
        purchasedCreditsUsed: 0,
        starterCredits: 1000,
        starterCreditsUsed: 0,
      };

      const deductions = calculateCreditDeductions(50, balance);

      expect(deductions).toEqual([
        { source: "daily", amount: 20 },
        { source: "starter", amount: 30 },
      ]);
    });
  });

  describe("Credit Calculations", () => {
    it("should calculate step credits correctly", () => {
      // 1 credit per 1K input, 3 credits per 1K output
      expect(calculateStepCredits(1000, 1000)).toBe(4);  // 1 + 3
      expect(calculateStepCredits(500, 0)).toBe(1);       // ceil(0.5) = 1
      expect(calculateStepCredits(0, 500)).toBe(3);       // ceil(0.5)*3 = 3
      expect(calculateStepCredits(2500, 1500)).toBe(9);   // 3 + 6
      expect(calculateStepCredits(0, 0)).toBe(0);         // 0 + 0
    });

    it("should correctly price all tool categories", () => {
      // Browser tools
      expect(getToolCreditCost("browser_navigate")).toBe(3);
      expect(getToolCreditCost("browser_click")).toBe(1);
      expect(getToolCreditCost("browser_screenshot")).toBe(2);

      // File tools
      expect(getToolCreditCost("file_read")).toBe(1);
      expect(getToolCreditCost("file_edit")).toBe(2);

      // Shell
      expect(getToolCreditCost("shell_exec")).toBe(3);

      // Search
      expect(getToolCreditCost("web_search")).toBe(5);

      // Image gen
      expect(getToolCreditCost("image_generation")).toBe(10);

      // Free tools
      expect(getToolCreditCost("show_plan")).toBe(0);
      expect(getToolCreditCost("message_user")).toBe(0);

      // Parallel tasks parent (free, subtasks billed individually)
      expect(getToolCreditCost("parallel_tasks")).toBe(0);

      // Composio tools
      expect(getToolCreditCost("gmail_send_email")).toBe(3);
      expect(getToolCreditCost("slack_send_message")).toBe(3);

      // Unknown tools
      expect(getToolCreditCost("totally_random")).toBe(1);
    });
  });

  describe("Plan Limits", () => {
    it("should define correct limits for all 3 plans", () => {
      const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
      const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
      const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

      // Parallel subtask limits
      expect(light.maxParallelSubtasks).toBe(5);
      expect(pro.maxParallelSubtasks).toBe(10);
      expect(max.maxParallelSubtasks).toBe(20);

      // Concurrent sessions
      expect(light.maxConcurrentSessions).toBe(1);
      expect(pro.maxConcurrentSessions).toBe(3);
      expect(max.maxConcurrentSessions).toBe(10);

      // Steps per session
      expect(light.maxStepsPerSession).toBe(15);
      expect(pro.maxStepsPerSession).toBe(30);
      expect(max.maxStepsPerSession).toBe(50);

      // Daily refresh (same for all plans)
      expect(light.dailyRefreshCredits).toBe(300);
      expect(pro.dailyRefreshCredits).toBe(300);
      expect(max.dailyRefreshCredits).toBe(300);
    });

    it("should return free limits when user has no subscription", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([]); // No subscription

      const limits = await getUserPlanLimits("user-e2e");

      expect(limits.planType).toBe("free");
      expect(limits.maxParallelSubtasks).toBe(FREE_PLAN_LIMITS.maxParallelSubtasks);
      expect(limits.maxConcurrentSessions).toBe(FREE_PLAN_LIMITS.maxConcurrentSessions);
      expect(limits.maxStepsPerSession).toBe(FREE_PLAN_LIMITS.maxStepsPerSession);
    });
  });

  describe("Balance Edge Cases", () => {
    it("should hard_block when balance hits zero during session", async () => {
      const zeroBalance = makeDefaultBalance({
        balance: 0,
        dailyCredits: 0,
        dailyCreditsUsed: 0,
        starterCredits: 0,
        starterCreditsUsed: 0,
      });

      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([zeroBalance])
        .mockResolvedValueOnce([zeroBalance]);

      const check = await checkCredits("user-e2e", 1);

      expect(check.hasCredits).toBe(false);
      expect(check.state).toBe("hard_block");
      expect(check.currentBalance).toBe(0);
    });

    it("should handle Pro user with mixed credit sources", async () => {
      const proBalance = makeDefaultBalance({
        balance: 5200,
        dailyCredits: 300,
        dailyCreditsUsed: 100,
        periodCredits: 3900,
        periodCreditsUsed: 0,
        starterCredits: 1000,
        starterCreditsUsed: 0,
      });

      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([proBalance])
        .mockResolvedValueOnce([proBalance]);

      const check = await checkCredits("user-e2e", 10);

      expect(check.hasCredits).toBe(true);
      expect(check.state).toBe("ok");
      expect(check.dailyAvailable).toBe(200);
      expect(check.monthlyAvailable).toBe(3900);
      expect(check.starterAvailable).toBe(1000);
      expect(check.currentBalance).toBe(5100); // 200 + 3900 + 0 + 1000
    });
  });

  describe("Daily Credit Refresh", () => {
    it("should refresh when last refresh was yesterday", async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(12, 0, 0, 0); // Noon yesterday — clearly before today midnight

      const staleBalance = makeDefaultBalance({
        dailyCredits: 300,
        dailyCreditsUsed: 280,
        lastDailyRefreshAt: yesterday,
      });

      // db.select (outside transaction) for the initial balance read
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([staleBalance]);

      const refreshed = await refreshDailyCreditsIfNeeded("user-e2e");

      expect(refreshed).toBe(true);
      // Transaction was called (refresh writes via db.transaction)
      const dbMod = await import("../lib/db.js");
      expect(dbMod.db.transaction).toHaveBeenCalled();
    });

    it("should not refresh if already refreshed today", async () => {
      const freshBalance = makeDefaultBalance({
        lastDailyRefreshAt: new Date(), // Just now
      });

      vi.mocked(mockSelect.limit).mockResolvedValueOnce([freshBalance]);

      const refreshed = await refreshDailyCreditsIfNeeded("user-e2e");

      expect(refreshed).toBe(false);
      expect(mockUpdate.set).not.toHaveBeenCalled();
    });
  });

  describe("Session Cost Simulation", () => {
    it("should calculate realistic session cost for typical usage", () => {
      // Typical 10-step agent session:
      // - 10 LLM steps: avg 2000 input + 800 output tokens each
      // - 3 browser_navigate + 5 browser_click + 2 browser_screenshot
      // - 1 web_search + 2 file_write + 1 shell_exec
      // - 8 minutes of sandbox time

      // LLM costs
      let totalCredits = 0;
      for (let i = 0; i < 10; i++) {
        totalCredits += calculateStepCredits(2000, 800); // 2 + 3 = 5 credits each
      }
      expect(totalCredits).toBe(50); // 10 × 5

      // Tool costs
      totalCredits += 3 * getToolCreditCost("browser_navigate"); // 3 × 3 = 9
      totalCredits += 5 * getToolCreditCost("browser_click");     // 5 × 1 = 5
      totalCredits += 2 * getToolCreditCost("browser_screenshot"); // 2 × 2 = 4
      totalCredits += 1 * getToolCreditCost("web_search");         // 1 × 5 = 5
      totalCredits += 2 * getToolCreditCost("file_write");         // 2 × 1 = 2
      totalCredits += 1 * getToolCreditCost("shell_exec");         // 1 × 3 = 3

      // VM time: 8 minutes × 2 = 16 credits
      totalCredits += Math.ceil(8) * VM_CREDITS_PER_MINUTE;

      // Total: 50 + 9 + 5 + 4 + 5 + 2 + 3 + 16 = 94 credits
      expect(totalCredits).toBe(94);

      // Free user (1300 credits) can afford ~13 such sessions
      expect(Math.floor(1300 / totalCredits)).toBe(13);

      // Pro user (300 daily + 3900 monthly + 1000 starter = 5200) can afford ~55 such sessions
      expect(Math.floor(5200 / totalCredits)).toBe(55);
    });

    it("should calculate cost for parallel subtask session", () => {
      // Parallel tasks session: 5 subtasks (text) + 2 image gen
      let totalCredits = 0;

      // 5 text subtasks: avg 1500 input + 600 output each
      for (let i = 0; i < 5; i++) {
        totalCredits += calculateStepCredits(1500, 600); // 2 + 3 = 5 credits
      }

      // 2 image generations: 10 credits each
      totalCredits += 2 * getToolCreditCost("image_generation");

      // Plus the orchestrator step that spawned parallel_tasks (parent free)
      totalCredits += calculateStepCredits(3000, 500); // 3 + 3 = 6
      totalCredits += getToolCreditCost("parallel_tasks"); // 0 (free)

      // Total: 25 + 20 + 6 + 0 = 51 credits
      expect(totalCredits).toBe(51);
    });
  });

  describe("Pricing Consistency", () => {
    it("should have prices that match Manus tiers", () => {
      const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
      const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
      const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

      // Free tier
      expect(light.priceMonthly).toBe(0);
      expect(light.monthlyCredits).toBe(0);
      expect(light.starterCredits).toBe(1000);

      // Pro: $39/mo = 3900 cents
      expect(pro.priceMonthly).toBe(3900);
      expect(pro.monthlyCredits).toBe(3900);

      // Max: $199/mo = 19900 cents
      expect(max.priceMonthly).toBe(19900);
      expect(max.monthlyCredits).toBe(19900);

      // Yearly discount: 17%
      expect(pro.discountYearlyPercent).toBe(17);
      expect(max.discountYearlyPercent).toBe(17);
    });

    it("should have all tool costs defined for known tools", () => {
      const requiredTools = [
        "browser_navigate", "browser_click", "browser_screenshot",
        "file_read", "file_write", "file_edit",
        "shell_exec", "web_search", "image_generation",
        "parallel_tasks", "show_plan", "message_user",
      ];

      for (const tool of requiredTools) {
        expect(TOOL_CREDIT_COSTS[tool]).toBeDefined();
      }
    });
  });
});
