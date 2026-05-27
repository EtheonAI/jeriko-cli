import { createId, dispatchWebhookEvent } from "@repo/service-utils";
import { db, creditBalances, usageLedger, creditTransactions, usageRecords, userSubscriptions, subscriptionPlans, eq, sql, and } from "./db.js";
import {
  calculateStepCredits,
  getToolCreditCost,
  calculateCreditDeductions,
  FREE_PLAN_LIMITS,
  type CreditDeduction,
} from "./plans.js";

/**
 * Metering Service — Manus Parity
 *
 * Credit consumption order: daily → monthly → purchased → starter
 * 4-state enforcement: ok → warning → soft_block → hard_block
 */

export interface MeteringEvent {
  userId: string;
  eventType: "step_start" | "step_finish" | "tool_call" | "vm_time" | "daily_refresh" | "credits_grant" | "credits_deduct";
  sessionId?: string;
  stepId?: string;
  toolName?: string;
  creditsCharged: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export type CreditState = "ok" | "warning" | "soft_block" | "hard_block";

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  required: number;
  state: CreditState;
  dailyAvailable: number;
  monthlyAvailable: number;
  purchasedAvailable: number;
  starterAvailable: number;
}

export interface PlanLimits {
  maxConcurrentSessions: number;
  maxParallelSubtasks: number;
  maxScheduledTasks: number;
  maxStepsPerSession: number;
  dailyRefreshCredits: number;
  planType: string;
  planName: string;
}

/**
 * Check if user has sufficient credits for an operation.
 * Also performs daily credit refresh if needed.
 */
export async function checkCredits(userId: string, required: number): Promise<CreditCheckResult> {
  // Auto-refresh daily credits if needed
  await refreshDailyCreditsIfNeeded(userId);

  const [balance] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (!balance) {
    return {
      hasCredits: false,
      currentBalance: 0,
      required,
      state: "hard_block",
      dailyAvailable: 0,
      monthlyAvailable: 0,
      purchasedAvailable: 0,
      starterAvailable: 0,
    };
  }

  const dailyAvailable = balance.dailyCredits - balance.dailyCreditsUsed;
  const monthlyAvailable = balance.periodCredits - balance.periodCreditsUsed;
  const purchasedAvailable = balance.purchasedCredits - balance.purchasedCreditsUsed;
  const starterAvailable = balance.starterCredits - balance.starterCreditsUsed;
  const totalAvailable = dailyAvailable + monthlyAvailable + purchasedAvailable + starterAvailable;

  // Determine credit state
  let state: CreditState;
  if (totalAvailable <= 0) {
    state = "hard_block";
  } else if (totalAvailable < required) {
    state = "soft_block";
  } else if (totalAvailable < required * 3) {
    state = "warning";
  } else {
    state = "ok";
  }

  return {
    hasCredits: totalAvailable >= required,
    currentBalance: totalAvailable,
    required,
    state,
    dailyAvailable: Math.max(0, dailyAvailable),
    monthlyAvailable: Math.max(0, monthlyAvailable),
    purchasedAvailable: Math.max(0, purchasedAvailable),
    starterAvailable: Math.max(0, starterAvailable),
  };
}

/**
 * Get plan limits for a user (checks subscription → plan → defaults).
 */
export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const [sub] = await db
    .select({
      planId: userSubscriptions.planId,
      status: userSubscriptions.status,
    })
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId)))
    .limit(1);

  if (!sub || sub.status !== "active") {
    return {
      ...FREE_PLAN_LIMITS,
      planType: "free",
      planName: "Jeriko Light",
    };
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, sub.planId))
    .limit(1);

  if (!plan) {
    return {
      ...FREE_PLAN_LIMITS,
      planType: "free",
      planName: "Jeriko Light",
    };
  }

  return {
    maxConcurrentSessions: plan.maxConcurrentSessions,
    maxParallelSubtasks: plan.maxParallelSubtasks,
    maxScheduledTasks: plan.maxScheduledTasks,
    maxStepsPerSession: plan.maxStepsPerSession,
    dailyRefreshCredits: plan.dailyRefreshCredits,
    planType: plan.type,
    planName: plan.name,
  };
}

/**
 * Refresh daily credits if the last refresh was before today (UTC midnight).
 */
export async function refreshDailyCreditsIfNeeded(userId: string): Promise<boolean> {
  const [balance] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (!balance) return false;

  const now = new Date();
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Check if we already refreshed today
  if (balance.lastDailyRefreshAt && balance.lastDailyRefreshAt >= todayMidnight) {
    return false;
  }

  // Refresh: set daily credits to the refresh amount, reset used to 0
  const refreshAmount = balance.dailyRefreshAmount || 300;

  await db.transaction(async (tx: any) => {
    await tx
      .update(creditBalances)
      .set({
        dailyCredits: refreshAmount,
        dailyCreditsUsed: 0,
        lastDailyRefreshAt: now,
        // Also update the total balance: remove old daily, add new daily
        balance: sql`${creditBalances.balance} - (${creditBalances.dailyCredits} - ${creditBalances.dailyCreditsUsed}) + ${refreshAmount}`,
      })
      .where(eq(creditBalances.userId, userId));

    // Ledger entry for daily refresh
    await tx.insert(usageLedger).values({
      id: createId(),
      userId,
      eventType: "daily_refresh",
      creditsCharged: refreshAmount,
      balanceBefore: balance.balance,
      balanceAfter: balance.balance - (balance.dailyCredits - balance.dailyCreditsUsed) + refreshAmount,
      metadata: { refreshAmount, previousDaily: balance.dailyCredits, previousDailyUsed: balance.dailyCreditsUsed },
    });
  });

  return true;
}

/**
 * Record a metering event with proper credit consumption order.
 * Deducts from: daily → monthly → purchased → starter.
 */
export async function recordMeteringEvent(event: MeteringEvent): Promise<void> {
  const { userId, eventType, creditsCharged, sessionId, stepId, toolName, inputTokens, outputTokens, model, metadata } = event;

  if (creditsCharged <= 0 && eventType !== "credits_grant" && eventType !== "daily_refresh") {
    // Zero-cost event — just log to ledger
    await db.insert(usageLedger).values({
      id: createId(),
      userId,
      eventType,
      sessionId,
      stepId,
      toolName,
      creditsCharged: 0,
      inputTokens,
      outputTokens,
      model,
      balanceBefore: 0,
      balanceAfter: 0,
      metadata,
    });
    return;
  }

  await db.transaction(async (tx: any) => {
    // Get current balance
    const [currentBalance] = await tx
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    const balanceBefore = currentBalance?.balance ?? 0;
    let balanceAfter = balanceBefore;

    // Only deduct for charge events
    if (eventType === "step_finish" || eventType === "tool_call" || eventType === "vm_time" || eventType === "credits_deduct") {
      if (!currentBalance) {
        // No balance record — can't deduct
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
          balanceBefore: 0,
          balanceAfter: 0,
          metadata: { ...metadata, error: "no_balance_record" },
        });
        return;
      }

      // Calculate deductions using consumption order
      const deductions = calculateCreditDeductions(creditsCharged, {
        dailyCredits: currentBalance.dailyCredits,
        dailyCreditsUsed: currentBalance.dailyCreditsUsed,
        periodCredits: currentBalance.periodCredits,
        periodCreditsUsed: currentBalance.periodCreditsUsed,
        purchasedCredits: currentBalance.purchasedCredits,
        purchasedCreditsUsed: currentBalance.purchasedCreditsUsed,
        starterCredits: currentBalance.starterCredits,
        starterCreditsUsed: currentBalance.starterCreditsUsed,
      });

      // Apply deductions atomically
      const updates: Record<string, unknown> = {
        balance: sql`${creditBalances.balance} - ${creditsCharged}`,
      };

      for (const d of deductions) {
        switch (d.source) {
          case "daily":
            updates.dailyCreditsUsed = sql`${creditBalances.dailyCreditsUsed} + ${d.amount}`;
            break;
          case "monthly":
            updates.periodCreditsUsed = sql`${creditBalances.periodCreditsUsed} + ${d.amount}`;
            break;
          case "purchased":
            updates.purchasedCreditsUsed = sql`${creditBalances.purchasedCreditsUsed} + ${d.amount}`;
            break;
          case "starter":
            updates.starterCreditsUsed = sql`${creditBalances.starterCreditsUsed} + ${d.amount}`;
            break;
        }
      }

      const [updated] = await tx
        .update(creditBalances)
        .set(updates)
        .where(eq(creditBalances.userId, userId))
        .returning({ balance: creditBalances.balance });

      balanceAfter = updated?.balance ?? balanceBefore - creditsCharged;

      // Credit transaction record
      await tx.insert(creditTransactions).values({
        id: createId(),
        userId,
        type: "usage",
        amount: -creditsCharged,
        balanceAfter,
        referenceType: sessionId ? "session" : undefined,
        referenceId: sessionId,
        description: `${eventType}: ${toolName ?? stepId ?? "unknown"}`,
        metadata: { ...metadata, deductions },
      });

      // Usage record for aggregation
      if (sessionId) {
        await tx.insert(usageRecords).values({
          id: createId(),
          userId,
          type: eventType === "tool_call" ? "agent" : "chat",
          credits: creditsCharged,
          sessionId,
          model,
          inputTokens,
          outputTokens,
          description: `${eventType}: ${toolName ?? stepId ?? "unknown"}`,
          metadata,
        });
      }
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

    // Dispatch credits update event for real-time UI sync
    if (creditsCharged > 0 && (eventType === "step_finish" || eventType === "tool_call" || eventType === "vm_time" || eventType === "credits_deduct")) {
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
 * Meter a step finish event.
 * Called by orchestrator after each LLM completion step.
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
  const creditsCharged = calculateStepCredits(
    params.inputTokens ?? 0,
    params.outputTokens ?? 0,
  );

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
 * Meter a tool call event.
 * Called by tool execution hooks.
 */
export async function meterToolCall(params: {
  userId: string;
  sessionId: string;
  toolName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const creditsCharged = getToolCreditCost(params.toolName);

  // Skip zero-cost tools (show_plan, message_draft, etc.)
  if (creditsCharged === 0) return;

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
 * Meter sandbox VM time.
 * Charges 2 credits per minute of active sandbox time (Manus parity).
 */
export const VM_CREDITS_PER_MINUTE = 2;

export async function meterVmTime(params: {
  userId: string;
  sessionId: string;
  sandboxId: string;
  durationMinutes: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const creditsCharged = Math.ceil(params.durationMinutes) * VM_CREDITS_PER_MINUTE;

  if (creditsCharged <= 0) return;

  await recordMeteringEvent({
    userId: params.userId,
    eventType: "vm_time",
    sessionId: params.sessionId,
    toolName: "sandbox_vm",
    creditsCharged,
    metadata: {
      ...params.metadata,
      sandboxId: params.sandboxId,
      durationMinutes: params.durationMinutes,
      ratePerMinute: VM_CREDITS_PER_MINUTE,
    },
  });
}

/**
 * Initialize credit balance for a new user.
 * Grants starter credits + sets up daily refresh.
 */
export async function initializeUserCredits(
  userId: string,
  starterCredits: number = 1000,
  dailyRefreshAmount: number = 300,
): Promise<void> {
  const [existing] = await db
    .select({ id: creditBalances.id })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existing) return; // Already initialized

  const now = new Date();

  await db.transaction(async (tx: any) => {
    await tx.insert(creditBalances).values({
      id: createId(),
      userId,
      balance: starterCredits + dailyRefreshAmount,
      dailyCredits: dailyRefreshAmount,
      dailyCreditsUsed: 0,
      dailyRefreshAmount,
      lastDailyRefreshAt: now,
      starterCredits,
      starterCreditsUsed: 0,
      periodCredits: 0,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
    });

    // Record starter credits grant
    await tx.insert(creditTransactions).values({
      id: createId(),
      userId,
      type: "bonus",
      amount: starterCredits,
      balanceAfter: starterCredits + dailyRefreshAmount,
      description: "Welcome starter credits (never expire)",
    });

    // Ledger entry
    await tx.insert(usageLedger).values({
      id: createId(),
      userId,
      eventType: "credits_grant",
      creditsCharged: starterCredits + dailyRefreshAmount,
      balanceBefore: 0,
      balanceAfter: starterCredits + dailyRefreshAmount,
      metadata: { type: "initialization", starterCredits, dailyRefreshAmount },
    });
  });
}
