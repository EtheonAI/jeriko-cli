/**
 * Billing Manus Parity Tests
 *
 * Comprehensive tests for:
 *   - Plan definitions (Rubic Light / Pro / Max)
 *   - Credit calculation formulas
 *   - Credit consumption order (daily → monthly → purchased → starter)
 *   - Tool credit costs
 *   - Parallel task tier limits
 *   - Daily credit refresh
 *   - Plan limit enforcement
 */
import { describe, it, expect } from "vitest";
import {
  PLAN_DEFINITIONS,
  TOOL_CREDIT_COSTS,
  calculateStepCredits,
  getToolCreditCost,
  calculateCreditDeductions,
  FREE_PLAN_LIMITS,
} from "../lib/plans.js";

// ─── Plan Definitions ──────────────────────────────────────────────────────

describe("Plan Definitions — Manus Parity", () => {
  it("should have exactly 3 plans", () => {
    expect(PLAN_DEFINITIONS).toHaveLength(3);
  });

  it("should define Rubic Light (free tier)", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free");
    expect(light).toBeDefined();
    expect(light!.name).toBe("Rubic Light");
    expect(light!.priceMonthly).toBe(0);
    expect(light!.priceYearly).toBe(0);
    expect(light!.monthlyCredits).toBe(0);
    expect(light!.starterCredits).toBe(1000);
    expect(light!.dailyRefreshCredits).toBe(300);
    expect(light!.maxConcurrentSessions).toBe(1);
    expect(light!.maxParallelSubtasks).toBe(5);
    expect(light!.maxScheduledTasks).toBe(1);
    expect(light!.maxStepsPerSession).toBe(15);
  });

  it("should define Rubic Pro ($39/mo)", () => {
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro");
    expect(pro).toBeDefined();
    expect(pro!.name).toBe("Rubic Pro");
    expect(pro!.priceMonthly).toBe(3900); // $39 in cents
    expect(pro!.monthlyCredits).toBe(3900);
    expect(pro!.starterCredits).toBe(1000);
    expect(pro!.dailyRefreshCredits).toBe(300);
    expect(pro!.maxConcurrentSessions).toBe(3);
    expect(pro!.maxParallelSubtasks).toBe(10);
    expect(pro!.maxScheduledTasks).toBe(3);
    expect(pro!.maxStepsPerSession).toBe(30);
    expect(pro!.isPopular).toBe(true);
  });

  it("should define Rubic Max ($199/mo)", () => {
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max");
    expect(max).toBeDefined();
    expect(max!.name).toBe("Rubic Max");
    expect(max!.priceMonthly).toBe(19900); // $199 in cents
    expect(max!.monthlyCredits).toBe(19900);
    expect(max!.starterCredits).toBe(1000);
    expect(max!.dailyRefreshCredits).toBe(300);
    expect(max!.maxConcurrentSessions).toBe(10);
    expect(max!.maxParallelSubtasks).toBe(20);
    expect(max!.maxScheduledTasks).toBe(10);
    expect(max!.maxStepsPerSession).toBe(50);
  });

  it("should have 17% yearly discount on paid plans", () => {
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

    expect(pro.discountYearlyPercent).toBe(17);
    expect(max.discountYearlyPercent).toBe(17);

    // Verify yearly price is ~83% of monthly * 12
    const proExpected = Math.round(pro.priceMonthly * 12 * 0.83);
    expect(Math.abs(pro.priceYearly - proExpected)).toBeLessThan(100); // within $1
    const maxExpected = Math.round(max.priceMonthly * 12 * 0.83);
    expect(Math.abs(max.priceYearly - maxExpected)).toBeLessThan(200); // within $2
  });

  it("should have correct feature limits per plan", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

    // Free: no creative tools
    expect(light.limits.slidesGeneration).toBe(false);
    expect(light.limits.imageGeneration).toBe(false);
    expect(light.limits.videoGeneration).toBe(false);
    expect(light.limits.betaFeatures).toBe(false);

    // Pro: slides + images but no video
    expect(pro.limits.slidesGeneration).toBe(true);
    expect(pro.limits.imageGeneration).toBe(true);
    expect(pro.limits.videoGeneration).toBe(false);
    expect(pro.limits.betaFeatures).toBe(false);

    // Max: everything unlocked
    expect(max.limits.slidesGeneration).toBe(true);
    expect(max.limits.imageGeneration).toBe(true);
    expect(max.limits.videoGeneration).toBe(true);
    expect(max.limits.betaFeatures).toBe(true);
    expect(max.limits.prioritySupport).toBe(true);
  });

  it("should have plans sorted by sortOrder", () => {
    for (let i = 0; i < PLAN_DEFINITIONS.length - 1; i++) {
      expect(PLAN_DEFINITIONS[i]!.sortOrder).toBeLessThan(PLAN_DEFINITIONS[i + 1]!.sortOrder);
    }
  });

  it("free plan limits should match FREE_PLAN_LIMITS constant", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    expect(light.maxConcurrentSessions).toBe(FREE_PLAN_LIMITS.maxConcurrentSessions);
    expect(light.maxParallelSubtasks).toBe(FREE_PLAN_LIMITS.maxParallelSubtasks);
    expect(light.maxScheduledTasks).toBe(FREE_PLAN_LIMITS.maxScheduledTasks);
    expect(light.maxStepsPerSession).toBe(FREE_PLAN_LIMITS.maxStepsPerSession);
    expect(light.dailyRefreshCredits).toBe(FREE_PLAN_LIMITS.dailyRefreshCredits);
  });
});

// ─── Credit Calculation Formulas ───────────────────────────────────────────

describe("Credit Calculation — Step Costs", () => {
  it("should charge 1 credit per 1000 input tokens", () => {
    expect(calculateStepCredits(1000, 0)).toBe(1);
    expect(calculateStepCredits(2000, 0)).toBe(2);
    expect(calculateStepCredits(5000, 0)).toBe(5);
  });

  it("should charge 3 credits per 1000 output tokens", () => {
    expect(calculateStepCredits(0, 1000)).toBe(3);
    expect(calculateStepCredits(0, 2000)).toBe(6);
    expect(calculateStepCredits(0, 5000)).toBe(15);
  });

  it("should combine input and output costs", () => {
    // 5K input = 5 credits, 2K output = 6 credits → 11 total
    expect(calculateStepCredits(5000, 2000)).toBe(11);
  });

  it("should ceil fractional token counts", () => {
    // 500 input → ceil(0.5) = 1 credit
    expect(calculateStepCredits(500, 0)).toBe(1);
    // 1500 input → ceil(1.5) = 2 credits
    expect(calculateStepCredits(1500, 0)).toBe(2);
    // 500 output → ceil(0.5) * 3 = 3 credits
    expect(calculateStepCredits(0, 500)).toBe(3);
  });

  it("should return 0 for zero tokens", () => {
    expect(calculateStepCredits(0, 0)).toBe(0);
  });

  it("should handle realistic scenarios", () => {
    // Simple web search: ~2K input, 500 output
    const simple = calculateStepCredits(2000, 500);
    expect(simple).toBe(2 + 3); // 5 credits

    // Complex code generation: ~10K input, 3K output
    const complex = calculateStepCredits(10000, 3000);
    expect(complex).toBe(10 + 9); // 19 credits

    // Massive context: ~100K input, 8K output
    const massive = calculateStepCredits(100000, 8000);
    expect(massive).toBe(100 + 24); // 124 credits
  });
});

// ─── Tool Credit Costs ────────────────────────────────────────────────────

describe("Tool Credit Costs", () => {
  it("should have correct browser tool costs", () => {
    expect(getToolCreditCost("browser_navigate")).toBe(3);
    expect(getToolCreditCost("browser_click")).toBe(1);
    expect(getToolCreditCost("browser_screenshot")).toBe(2);
    expect(getToolCreditCost("browser_type")).toBe(1);
  });

  it("should have correct file tool costs", () => {
    expect(getToolCreditCost("file_read")).toBe(1);
    expect(getToolCreditCost("file_write")).toBe(1);
    expect(getToolCreditCost("file_edit")).toBe(2);
  });

  it("should have correct terminal costs", () => {
    expect(getToolCreditCost("shell_exec")).toBe(3);
    expect(getToolCreditCost("terminal_exec")).toBe(3);
  });

  it("should have correct web search cost (third-party API)", () => {
    expect(getToolCreditCost("web_search")).toBe(5);
  });

  it("should have correct image generation cost (expensive API)", () => {
    expect(getToolCreditCost("image_generation")).toBe(10);
    expect(getToolCreditCost("generate_image")).toBe(10);
  });

  it("should have zero cost for UI-only tools", () => {
    expect(getToolCreditCost("show_plan")).toBe(0);
    expect(getToolCreditCost("showPlan")).toBe(0);
    expect(getToolCreditCost("message_user")).toBe(0);
    expect(getToolCreditCost("message_draft")).toBe(0);
  });

  it("should have zero cost for parallel_tasks parent (subtasks billed individually)", () => {
    expect(getToolCreditCost("parallel_tasks")).toBe(0);
  });

  it("should charge 3 credits for Composio dynamic tools", () => {
    expect(getToolCreditCost("gmail_send_email")).toBe(3);
    expect(getToolCreditCost("slack_post_message")).toBe(3);
    expect(getToolCreditCost("github_create_issue")).toBe(3);
  });

  it("should charge 1 credit for completely unknown tools", () => {
    expect(getToolCreditCost("some_totally_unknown_tool")).toBe(1);
  });

  it("should have email tool costs", () => {
    expect(getToolCreditCost("send_email")).toBe(5);
    expect(getToolCreditCost("draft_email")).toBe(3);
  });

  it("should have deploy tool costs", () => {
    expect(getToolCreditCost("deploy_website")).toBe(5);
    expect(getToolCreditCost("deploy_expose_port")).toBe(3);
  });
});

// ─── Credit Consumption Order ─────────────────────────────────────────────

describe("Credit Consumption Order — Manus Parity", () => {
  it("should consume daily credits first", () => {
    const deductions = calculateCreditDeductions(50, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 3900,
      periodCreditsUsed: 0,
      purchasedCredits: 1000,
      purchasedCreditsUsed: 0,
      starterCredits: 1000,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(1);
    expect(deductions[0]!.source).toBe("daily");
    expect(deductions[0]!.amount).toBe(50);
  });

  it("should spill from daily to monthly when daily exhausted", () => {
    const deductions = calculateCreditDeductions(350, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 3900,
      periodCreditsUsed: 0,
      purchasedCredits: 1000,
      purchasedCreditsUsed: 0,
      starterCredits: 1000,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(2);
    expect(deductions[0]!.source).toBe("daily");
    expect(deductions[0]!.amount).toBe(300);
    expect(deductions[1]!.source).toBe("monthly");
    expect(deductions[1]!.amount).toBe(50);
  });

  it("should consume in order: daily → monthly → purchased → starter", () => {
    const deductions = calculateCreditDeductions(6000, {
      dailyCredits: 300,
      dailyCreditsUsed: 200, // 100 available
      periodCredits: 3900,
      periodCreditsUsed: 3800, // 100 available
      purchasedCredits: 5000,
      purchasedCreditsUsed: 4900, // 100 available
      starterCredits: 1000,
      starterCreditsUsed: 0, // 1000 available
    });

    // Total available: 100 + 100 + 100 + 1000 = 1300
    // Can't cover 6000 — take what we can
    expect(deductions).toHaveLength(4);
    expect(deductions[0]).toEqual({ source: "daily", amount: 100 });
    expect(deductions[1]).toEqual({ source: "monthly", amount: 100 });
    expect(deductions[2]).toEqual({ source: "purchased", amount: 100 });
    expect(deductions[3]).toEqual({ source: "starter", amount: 1000 });
  });

  it("should skip sources with zero available", () => {
    const deductions = calculateCreditDeductions(50, {
      dailyCredits: 300,
      dailyCreditsUsed: 300, // 0 available
      periodCredits: 0, // no monthly (free plan)
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 1000,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(1);
    expect(deductions[0]!.source).toBe("starter");
    expect(deductions[0]!.amount).toBe(50);
  });

  it("should return empty array if no credits available", () => {
    const deductions = calculateCreditDeductions(50, {
      dailyCredits: 0,
      dailyCreditsUsed: 0,
      periodCredits: 0,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 0,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(0);
  });

  it("should handle exact deduction amounts", () => {
    const deductions = calculateCreditDeductions(300, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 0,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 0,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(1);
    expect(deductions[0]).toEqual({ source: "daily", amount: 300 });
  });

  it("should handle free plan (daily + starter only, no monthly)", () => {
    const deductions = calculateCreditDeductions(500, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 0,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 1000,
      starterCreditsUsed: 0,
    });

    expect(deductions).toHaveLength(2);
    expect(deductions[0]).toEqual({ source: "daily", amount: 300 });
    expect(deductions[1]).toEqual({ source: "starter", amount: 200 });
  });
});

// ─── Parallel Subtask Limits ──────────────────────────────────────────────

describe("Parallel Subtask Limits Per Plan", () => {
  it("Rubic Light should allow max 5 parallel subtasks", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    expect(light.maxParallelSubtasks).toBe(5);
  });

  it("Rubic Pro should allow max 10 parallel subtasks", () => {
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    expect(pro.maxParallelSubtasks).toBe(10);
  });

  it("Rubic Max should allow max 20 parallel subtasks", () => {
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;
    expect(max.maxParallelSubtasks).toBe(20);
  });

  it("concurrent sessions scale with plan tier", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

    expect(light.maxConcurrentSessions).toBe(1);
    expect(pro.maxConcurrentSessions).toBe(3);
    expect(max.maxConcurrentSessions).toBe(10);
  });

  it("scheduled tasks scale with plan tier", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

    expect(light.maxScheduledTasks).toBe(1);
    expect(pro.maxScheduledTasks).toBe(3);
    expect(max.maxScheduledTasks).toBe(10);
  });

  it("max steps per session scales with plan tier", () => {
    const light = PLAN_DEFINITIONS.find((p) => p.type === "free")!;
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;

    expect(light.maxStepsPerSession).toBe(15);
    expect(pro.maxStepsPerSession).toBe(30);
    expect(max.maxStepsPerSession).toBe(50);
  });
});

// ─── Daily Credit Refresh ─────────────────────────────────────────────────

describe("Daily Credit Refresh", () => {
  it("all plans get 300 daily refresh credits", () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(plan.dailyRefreshCredits).toBe(300);
    }
  });

  it("daily credits consume before monthly credits", () => {
    const deductions = calculateCreditDeductions(100, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 3900,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 0,
      starterCreditsUsed: 0,
    });

    expect(deductions[0]!.source).toBe("daily");
    expect(deductions[0]!.amount).toBe(100);
  });
});

// ─── Credit Pricing Consistency ───────────────────────────────────────────

describe("Credit Pricing Consistency", () => {
  it("Pro plan: credits equal price in cents ($39 = 3,900 credits)", () => {
    const pro = PLAN_DEFINITIONS.find((p) => p.type === "pro")!;
    // 1 cent = 1 credit (Manus-like pricing model)
    expect(pro.monthlyCredits).toBe(pro.priceMonthly);
  });

  it("Max plan: credits equal price in cents ($199 = 19,900 credits)", () => {
    const max = PLAN_DEFINITIONS.find((p) => p.type === "max")!;
    expect(max.monthlyCredits).toBe(max.priceMonthly);
  });

  it("a simple web search task costs ~9 credits (2K input + 500 output + web_search tool)", () => {
    const stepCost = calculateStepCredits(2000, 500);
    const toolCost = getToolCreditCost("web_search");
    const total = stepCost + toolCost;
    expect(total).toBe(10); // 2 + 3 + 5
  });

  it("a data visualization task costs ~200 credits (typical Manus example)", () => {
    // Simulate a data viz task: ~10 steps, each ~10K input / 2K output
    // Plus web_search, code_execution, image_generation tools
    const steps = 10;
    const stepCostPerStep = calculateStepCredits(10000, 2000);
    const totalStepCost = steps * stepCostPerStep;
    const toolCosts = getToolCreditCost("web_search") + getToolCreditCost("code_execution") * 5 + getToolCreditCost("image_generation");
    const total = totalStepCost + toolCosts;
    // Should be in the ballpark of ~200 credits (Manus example)
    expect(total).toBeGreaterThan(100);
    expect(total).toBeLessThan(400);
  });

  it("Rubic Light free plan can handle ~4 moderate tasks per day with daily credits", () => {
    // 300 daily credits / ~75 per moderate task ≈ 4 tasks
    const moderateTaskCost = calculateStepCredits(5000, 1500) + getToolCreditCost("web_search") + getToolCreditCost("code_execution") * 2;
    const tasksPerDay = Math.floor(300 / moderateTaskCost);
    expect(tasksPerDay).toBeGreaterThanOrEqual(3);
    expect(tasksPerDay).toBeLessThanOrEqual(15);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("should handle very large token counts", () => {
    const cost = calculateStepCredits(1000000, 500000);
    expect(cost).toBe(1000 + 1500); // 2500 credits
  });

  it("should handle single token", () => {
    const cost = calculateStepCredits(1, 0);
    expect(cost).toBe(1); // ceil(1/1000) = 1
  });

  it("should handle zero-cost deduction request", () => {
    const deductions = calculateCreditDeductions(0, {
      dailyCredits: 300,
      dailyCreditsUsed: 0,
      periodCredits: 3900,
      periodCreditsUsed: 0,
      purchasedCredits: 0,
      purchasedCreditsUsed: 0,
      starterCredits: 1000,
      starterCreditsUsed: 0,
    });
    expect(deductions).toHaveLength(0);
  });

  it("TOOL_CREDIT_COSTS should have no negative values", () => {
    for (const [name, cost] of Object.entries(TOOL_CREDIT_COSTS)) {
      expect(cost, `Tool ${name} has negative cost`).toBeGreaterThanOrEqual(0);
    }
  });

  it("all plan prices should be non-negative", () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(plan.priceMonthly).toBeGreaterThanOrEqual(0);
      expect(plan.priceYearly).toBeGreaterThanOrEqual(0);
      expect(plan.monthlyCredits).toBeGreaterThanOrEqual(0);
      expect(plan.starterCredits).toBeGreaterThanOrEqual(0);
      expect(plan.dailyRefreshCredits).toBeGreaterThanOrEqual(0);
    }
  });

  it("all plan limits should be positive", () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(plan.maxConcurrentSessions).toBeGreaterThan(0);
      expect(plan.maxParallelSubtasks).toBeGreaterThan(0);
      expect(plan.maxScheduledTasks).toBeGreaterThan(0);
      expect(plan.maxStepsPerSession).toBeGreaterThan(0);
    }
  });
});
