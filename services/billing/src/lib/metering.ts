import { createId, dispatchWebhookEvent } from "@repo/service-utils";
import { db, creditBalances, usageLedger, creditTransactions, eq, sql } from "./db.js";

/**
 * Metering Service
 * Handles all metering operations: step metering, tool metering, ledger writes, and credit updates
 */

export interface MeteringEvent {
  userId: string;
  eventType: "step_start" | "step_finish" | "tool_call" | "credits_grant" | "credits_deduct";
  sessionId?: string;
  stepId?: string;
  toolName?: string;
  creditsCharged: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  required: number;
}

/**
 * Check if user has sufficient credits for an operation
 */
export async function checkCredits(userId: string, required: number): Promise<CreditCheckResult> {
  const [balance] = await db
    .select({ balance: creditBalances.balance })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const currentBalance = balance?.balance ?? 0;
  return {
    hasCredits: currentBalance >= required,
    currentBalance,
    required,
  };
}

/**
 * Record a metering event to the immutable usage ledger and update credits
 * This is the core metering function used by step/tool hooks
 */
export async function recordMeteringEvent(event: MeteringEvent): Promise<void> {
  const { userId, eventType, creditsCharged, sessionId, stepId, toolName, inputTokens, outputTokens, model, metadata } = event;

  // Perform credit deduction and ledger write atomically
  await db.transaction(async (tx) => {
    // Get current balance
    const [currentBalance] = await tx
      .select({ balance: creditBalances.balance })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    const balanceBefore = currentBalance?.balance ?? 0;

    let balanceAfter = balanceBefore;

    // Only deduct for charge events
    if (eventType === "step_finish" || eventType === "tool_call" || eventType === "credits_deduct") {
      // Deduct credits atomically
      const [updated] = await tx
        .update(creditBalances)
        .set({
          balance: sql`${creditBalances.balance} - ${creditsCharged}`,
          periodCreditsUsed: sql`${creditBalances.periodCreditsUsed} + ${creditsCharged}`,
        })
        .where(eq(creditBalances.userId, userId))
        .returning({ balance: creditBalances.balance });

      balanceAfter = updated?.balance ?? balanceBefore - creditsCharged;

      // Record credit transaction
      await tx.insert(creditTransactions).values({
        id: createId(),
        userId,
        type: "usage",
        amount: -creditsCharged,
        balanceAfter,
        referenceType: sessionId ? "session" : undefined,
        referenceId: sessionId,
        description: `${eventType}: ${toolName ?? stepId ?? "unknown"}`,
        metadata,
      });
    }

    // Write immutable ledger entry
    await tx.insert(usageLedger).values({
      id: createId(),
      userId,
      eventType,
      sessionId,
      stepId,
      toolName,
      creditsCharged,
      inputTokens,
      outputTokens,
      model,
      balanceBefore,
      balanceAfter,
      metadata,
    });

    // Dispatch credits.update event if credits were charged
    if (creditsCharged > 0 && (eventType === "step_finish" || eventType === "tool_call" || eventType === "credits_deduct")) {
      dispatchWebhookEvent({
        eventType: "billing.credits.update",
        resourceType: "credits",
        resourceId: userId,
        payload: {
          userId,
          balanceBefore,
          balanceAfter,
          creditsCharged,
          eventType,
          sessionId,
          stepId,
          toolName,
        },
        userId,
      });
    }
  });
}

/**
 * Meter a step finish event
 * Called by orchestrator onStepFinish hook
 */
export async function meterStepFinish(params: {
  userId: string;
  sessionId: string;
  stepId: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const creditsCharged = calculateStepCredits({
    inputTokens: params.inputTokens ?? 0,
    outputTokens: params.outputTokens ?? 0,
  });

  await recordMeteringEvent({
    userId: params.userId,
    eventType: "step_finish",
    sessionId: params.sessionId,
    stepId: params.stepId,
    creditsCharged,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    model: params.model,
    metadata: params.metadata,
  });
}

/**
 * Meter a tool call event
 * Called by tool execution hooks
 */
export async function meterToolCall(params: {
  userId: string;
  sessionId: string;
  toolName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const creditsCharged = calculateToolCredits(params.toolName);

  await recordMeteringEvent({
    userId: params.userId,
    eventType: "tool_call",
    sessionId: params.sessionId,
    toolName: params.toolName,
    creditsCharged,
    metadata: params.metadata,
  });
}

/**
 * Calculate credits for a step based on token usage
 * Simple formula: 1 credit per 1000 input tokens, 3 credits per 1000 output tokens
 */
function calculateStepCredits(params: { inputTokens: number; outputTokens: number }): number {
  const inputCredits = Math.ceil(params.inputTokens / 1000);
  const outputCredits = Math.ceil(params.outputTokens / 1000) * 3;
  return inputCredits + outputCredits;
}

/**
 * Calculate credits for a tool call
 * Different tools have different costs
 */
function calculateToolCredits(toolName: string): number {
  // Tool credit costs (can be configured externally later)
  const toolCosts: Record<string, number> = {
    web_search: 5,
    image_generation: 10,
    code_execution: 3,
    file_upload: 2,
    // Default cost for unknown tools
  };

  return toolCosts[toolName] ?? 1;
}
