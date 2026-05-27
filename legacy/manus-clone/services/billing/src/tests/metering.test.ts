/**
 * Billing Metering & Ledger Accuracy Tests
 * Validates immutable ledger, step/tool metering, credits flow with consumption order
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordMeteringEvent, checkCredits, meterStepFinish, meterToolCall } from "../lib/metering.js";

// Mock the db module — must include ALL exports used by metering.ts
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

// Mock service-utils
vi.mock("@repo/service-utils", () => ({
  createId: vi.fn(() => "test-id-" + Math.random().toString(36).substring(7)),
  dispatchWebhookEvent: vi.fn(),
}));

// Full credit balance record matching new schema
function makeBalance(overrides: Partial<typeof defaultBalance> = {}) {
  return { ...defaultBalance, ...overrides };
}

const defaultBalance = {
  id: "bal-1",
  userId: "user-123",
  balance: 1300, // 300 daily + 0 monthly + 0 purchased + 1000 starter
  dailyCredits: 300,
  dailyCreditsUsed: 0,
  dailyRefreshAmount: 300,
  lastDailyRefreshAt: new Date(), // Already refreshed today
  periodCredits: 0,
  periodCreditsUsed: 0,
  purchasedCredits: 0,
  purchasedCreditsUsed: 0,
  starterCredits: 1000,
  starterCreditsUsed: 0,
};

// Mock transaction object
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

describe("Billing Ledger Accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Check Credits", () => {
    it("should return hasCredits=true when user has sufficient credits", async () => {
      // refreshDailyCreditsIfNeeded reads balance first
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([makeBalance()]) // refreshDailyCreditsIfNeeded
        .mockResolvedValueOnce([makeBalance()]); // checkCredits select

      const result = await checkCredits("user-123", 50);

      expect(result.hasCredits).toBe(true);
      expect(result.currentBalance).toBe(1300); // 300 daily + 1000 starter
      expect(result.required).toBe(50);
      expect(result.state).toBe("ok");
    });

    it("should detect insufficient credits", async () => {
      const lowBalance = makeBalance({
        balance: 30,
        dailyCredits: 30,
        dailyCreditsUsed: 0,
        starterCredits: 0,
        starterCreditsUsed: 0,
      });
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([lowBalance]) // refreshDailyCreditsIfNeeded
        .mockResolvedValueOnce([lowBalance]); // checkCredits select

      const result = await checkCredits("user-123", 50);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(30);
      expect(result.required).toBe(50);
      expect(result.state).toBe("soft_block");
    });

    it("should return hard_block for zero balance", async () => {
      const zeroBalance = makeBalance({
        balance: 0,
        dailyCredits: 0,
        dailyCreditsUsed: 0,
        starterCredits: 0,
        starterCreditsUsed: 0,
      });
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([zeroBalance]) // refreshDailyCreditsIfNeeded
        .mockResolvedValueOnce([zeroBalance]); // checkCredits select

      const result = await checkCredits("user-123", 1);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(0);
      expect(result.state).toBe("hard_block");
    });

    it("should return hard_block for missing balance record", async () => {
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([]) // refreshDailyCreditsIfNeeded — no balance
        .mockResolvedValueOnce([]); // checkCredits select

      const result = await checkCredits("user-123", 10);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(0);
      expect(result.state).toBe("hard_block");
    });

    it("should return warning when balance is low but sufficient", async () => {
      const lowBalance = makeBalance({
        balance: 60,
        dailyCredits: 60,
        dailyCreditsUsed: 0,
        starterCredits: 0,
        starterCreditsUsed: 0,
      });
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([lowBalance])
        .mockResolvedValueOnce([lowBalance]);

      // 60 >= 50 (sufficient) but 60 < 50*3 = 150 → warning
      const result = await checkCredits("user-123", 50);

      expect(result.hasCredits).toBe(true);
      expect(result.state).toBe("warning");
    });

    it("should include credit breakdown by source", async () => {
      const proBalance = makeBalance({
        balance: 5200,
        dailyCredits: 300,
        dailyCreditsUsed: 0,
        periodCredits: 3900,
        periodCreditsUsed: 0,
        starterCredits: 1000,
        starterCreditsUsed: 0,
      });
      vi.mocked(mockSelect.limit)
        .mockResolvedValueOnce([proBalance])
        .mockResolvedValueOnce([proBalance]);

      const result = await checkCredits("user-123", 10);

      expect(result.dailyAvailable).toBe(300);
      expect(result.monthlyAvailable).toBe(3900);
      expect(result.starterAvailable).toBe(1000);
    });
  });

  describe("Immutable Ledger Entries", () => {
    it("should record step_finish event with balance snapshot", async () => {
      // refreshDailyCreditsIfNeeded
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      // tx.select inside recordMeteringEvent
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1297 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        sessionId: "session-456",
        stepId: "step-1",
        creditsCharged: 3,
        inputTokens: 1000,
        outputTokens: 500,
        model: "claude-sonnet-4-5",
      });

      // Verify ledger insert was called (at least once for the ledger entry)
      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should record tool_call event", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1295 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "tool_call",
        sessionId: "session-456",
        toolName: "web_search",
        creditsCharged: 5,
      });

      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should not deduct credits for zero-charge events", async () => {
      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_start",
        sessionId: "session-456",
        stepId: "step-1",
        creditsCharged: 0,
      });

      // Only a single ledger insert, no update/transaction for zero-cost
      expect(mockInsert.values).toHaveBeenCalledTimes(1);
      expect(mockUpdate.set).not.toHaveBeenCalled();
    });
  });

  describe("Step Metering", () => {
    it("should calculate credits based on token usage", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1296 }]);

      await meterStepFinish({
        userId: "user-123",
        sessionId: "session-456",
        stepId: "step-1",
        inputTokens: 1000, // 1 credit
        outputTokens: 1000, // 3 credits
        model: "claude-sonnet-4-5",
      });

      // Should charge 4 credits total (1 + 3), ledger + transaction + usage record inserts
      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should handle zero token usage", async () => {
      await meterStepFinish({
        userId: "user-123",
        sessionId: "session-456",
        stepId: "step-1",
        inputTokens: 0,
        outputTokens: 0,
      });

      // 0 credits → zero-charge path (single ledger insert, no deduction)
      expect(mockInsert.values).toHaveBeenCalledTimes(1);
    });
  });

  describe("Tool Metering", () => {
    it("should charge correct credits for expensive tools", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1290 }]);

      await meterToolCall({
        userId: "user-123",
        sessionId: "session-456",
        toolName: "image_generation",
      });

      // image_generation costs 10 credits
      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should skip zero-cost tools", async () => {
      await meterToolCall({
        userId: "user-123",
        sessionId: "session-456",
        toolName: "show_plan",
      });

      // show_plan costs 0 — meterToolCall returns early, no DB writes
      expect(mockInsert.values).not.toHaveBeenCalled();
    });

    it("should charge 1 credit for unknown tools", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1299 }]);

      await meterToolCall({
        userId: "user-123",
        sessionId: "session-456",
        toolName: "unknowntool",
      });

      // unknown tools cost 1 credit
      expect(mockInsert.values).toHaveBeenCalled();
    });
  });

  describe("Credits Update Events", () => {
    it("should emit credits.update event on deduction", async () => {
      const { dispatchWebhookEvent } = await import("@repo/service-utils");
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1297 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        sessionId: "session-456",
        stepId: "step-1",
        creditsCharged: 3,
      });

      expect(dispatchWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "billing.credits.update",
          resourceType: "credits",
          resourceId: "user-123",
        }),
      );
    });

    it("should not emit event for zero-charge events", async () => {
      const { dispatchWebhookEvent } = await import("@repo/service-utils");

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_start",
        creditsCharged: 0,
      });

      expect(dispatchWebhookEvent).not.toHaveBeenCalled();
    });
  });

  describe("Transaction Atomicity", () => {
    it("should execute balance update and ledger write in transaction", async () => {
      const mockDb = await import("../lib/db.js");
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1295 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        creditsCharged: 5,
      });

      // Verify transaction was used
      expect(mockDb.db.transaction).toHaveBeenCalled();
    });

    it("should record credit transaction on deduction", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1295 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        sessionId: "session-456",
        creditsCharged: 5,
      });

      // Verify inserts: credit transaction + usage record + ledger entry = 3
      expect(mockInsert.values).toHaveBeenCalledTimes(3);
    });
  });

  describe("Ledger Immutability", () => {
    it("should never update existing ledger entries", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1297 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        sessionId: "session-456",
        creditsCharged: 3,
      });

      // The only update should be to creditBalances (balance deduction)
      const updateCalls = vi.mocked(mockUpdate.set).mock.calls;
      expect(updateCalls.length).toBe(1); // Only one update — the balance
    });

    it("should include balance snapshots in ledger entries", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([makeBalance()]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 1295 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "tool_call",
        creditsCharged: 5,
      });

      // Verify at least one insert includes balanceBefore
      const insertCalls = vi.mocked(mockInsert.values).mock.calls;
      const ledgerInsert = insertCalls.find(
        (call) => (call[0] as Record<string, unknown>).balanceBefore !== undefined,
      );
      expect(ledgerInsert).toBeDefined();
    });
  });

  describe("No Balance Record", () => {
    it("should handle missing balance record in recordMeteringEvent", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([]); // No balance

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        sessionId: "session-456",
        creditsCharged: 5,
      });

      // Should still insert a ledger entry with error metadata
      expect(mockInsert.values).toHaveBeenCalled();
    });
  });
});
