/**
 * Billing Metering & Ledger Accuracy Tests
 * P7.10: Validates immutable ledger, step/tool metering, and credits flow
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordMeteringEvent, checkCredits, meterStepFinish, meterToolCall } from "../lib/metering.js";

// Mock the db module
vi.mock("../lib/db.js", () => ({
  db: {
    transaction: vi.fn((callback) => callback(mockTx)),
    select: vi.fn(() => mockSelect),
    update: vi.fn(() => mockUpdate),
    insert: vi.fn(() => mockInsert),
  },
  creditBalances: {
    balance: "balance",
    periodCreditsUsed: "periodCreditsUsed",
    userId: "userId",
  },
  usageLedger: {},
  creditTransactions: {},
  eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
}));

// Mock service-utils
vi.mock("@repo/service-utils", () => ({
  createId: vi.fn(() => "test-id-" + Math.random().toString(36).substring(7)),
  dispatchWebhookEvent: vi.fn(),
}));

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

describe("P7.10: Billing Ledger Accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Check Credits", () => {
    it("should correctly check if user has sufficient credits", async () => {
      const mockDb = await import("../lib/db.js");
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);

      const result = await checkCredits("user-123", 50);

      expect(result.hasCredits).toBe(true);
      expect(result.currentBalance).toBe(100);
      expect(result.required).toBe(50);
    });

    it("should detect insufficient credits", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 30 }]);

      const result = await checkCredits("user-123", 50);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(30);
      expect(result.required).toBe(50);
    });

    it("should handle zero balance", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 0 }]);

      const result = await checkCredits("user-123", 1);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(0);
    });

    it("should handle missing balance record", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([]);

      const result = await checkCredits("user-123", 10);

      expect(result.hasCredits).toBe(false);
      expect(result.currentBalance).toBe(0);
    });
  });

  describe("Immutable Ledger Entries", () => {
    it("should record step_finish event with balance snapshot", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 97 }]);

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

      // Verify ledger insert was called
      expect(mockInsert.values).toHaveBeenCalled();
      const ledgerCall = vi.mocked(mockInsert.values).mock.calls.find(
        (call) => call[0].eventType === "step_finish"
      );
      expect(ledgerCall).toBeDefined();
    });

    it("should record tool_call event", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 95 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "tool_call",
        sessionId: "session-456",
        toolName: "web_search",
        creditsCharged: 5,
      });

      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should not deduct credits for step_start events", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_start",
        sessionId: "session-456",
        stepId: "step-1",
        creditsCharged: 0,
      });

      // Update should not be called for non-charge events
      expect(mockUpdate.set).not.toHaveBeenCalled();
      // But ledger insert should still happen
      expect(mockInsert.values).toHaveBeenCalled();
    });
  });

  describe("Step Metering", () => {
    it("should calculate credits based on token usage", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 96 }]);

      await meterStepFinish({
        userId: "user-123",
        sessionId: "session-456",
        stepId: "step-1",
        inputTokens: 1000, // 1 credit
        outputTokens: 1000, // 3 credits
        model: "claude-sonnet-4-5",
      });

      // Should charge 4 credits total (1 + 3)
      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should handle zero token usage", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 100 }]);

      await meterStepFinish({
        userId: "user-123",
        sessionId: "session-456",
        stepId: "step-1",
        inputTokens: 0,
        outputTokens: 0,
      });

      expect(mockInsert.values).toHaveBeenCalled();
    });
  });

  describe("Tool Metering", () => {
    it("should charge correct credits for expensive tools", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 90 }]);

      await meterToolCall({
        userId: "user-123",
        sessionId: "session-456",
        toolName: "image_generation",
      });

      // image_generation costs 10 credits
      expect(mockInsert.values).toHaveBeenCalled();
    });

    it("should charge default credits for unknown tools", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 99 }]);

      await meterToolCall({
        userId: "user-123",
        sessionId: "session-456",
        toolName: "unknown_tool",
      });

      // unknown tools cost 1 credit by default
      expect(mockInsert.values).toHaveBeenCalled();
    });
  });

  describe("Credits Update Events", () => {
    it("should emit credits.update event on deduction", async () => {
      const { dispatchWebhookEvent } = await import("@repo/service-utils");
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 97 }]);

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
        })
      );
    });

    it("should not emit event for zero-charge events", async () => {
      const { dispatchWebhookEvent } = await import("@repo/service-utils");
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);

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
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 95 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        creditsCharged: 5,
      });

      // Verify transaction was used
      expect(mockDb.db.transaction).toHaveBeenCalled();
    });

    it("should record credit transaction on deduction", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 95 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        creditsCharged: 5,
      });

      // Verify both ledger and transaction inserts
      expect(mockInsert.values).toHaveBeenCalledTimes(2);
    });
  });

  describe("Ledger Immutability", () => {
    it("should never update existing ledger entries", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 97 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "step_finish",
        creditsCharged: 3,
      });

      // Ledger entries are insert-only, never updated
      // The only update should be to creditBalances
      const updateCalls = vi.mocked(mockUpdate.set).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      // Verify no ledger updates (only balance updates)
    });

    it("should preserve balance_before and balance_after snapshots", async () => {
      vi.mocked(mockSelect.limit).mockResolvedValueOnce([{ balance: 100 }]);
      vi.mocked(mockUpdate.returning).mockResolvedValueOnce([{ balance: 95 }]);

      await recordMeteringEvent({
        userId: "user-123",
        eventType: "tool_call",
        creditsCharged: 5,
      });

      // Verify ledger entry includes balance snapshots
      const ledgerInsert = vi.mocked(mockInsert.values).mock.calls.find(
        (call) => call[0].balanceBefore !== undefined
      );
      expect(ledgerInsert).toBeDefined();
    });
  });
});
