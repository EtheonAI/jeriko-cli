/**
 * Plan Definitions — Manus Parity
 *
 * 3 subscription tiers matching Manus pricing:
 *   - Jeriko Light (Free): 1,000 starter credits + 300 daily refresh, 1 concurrent, 5 parallel subtasks
 *   - Jeriko Pro ($39/mo): 3,900 monthly credits + 300 daily refresh, 3 concurrent, 10 parallel subtasks
 *   - Jeriko Max ($199/mo): 19,900 monthly credits + 300 daily refresh, 10 concurrent, 20 parallel subtasks
 *
 * Credit consumption (Manus model):
 *   - LLM tokens: 1 credit per 1K input tokens, 3 credits per 1K output tokens
 *   - Virtual machines: 2 credits per minute of sandbox time
 *   - Tool calls: fixed per-tool costs (see TOOL_CREDIT_COSTS)
 *   - Daily refresh: 300 credits/day for ALL plans, expire at midnight UTC
 *   - Consumption order: daily → monthly → purchased → starter
 */

export interface PlanDefinition {
  name: string;
  type: "free" | "pro" | "max" | "enterprise";
  description: string;
  priceMonthly: number; // cents
  priceYearly: number; // cents
  discountYearlyPercent: number;
  monthlyCredits: number;
  starterCredits: number;
  dailyRefreshCredits: number;
  maxConcurrentSessions: number;
  maxParallelSubtasks: number;
  maxScheduledTasks: number;
  maxStepsPerSession: number;
  features: string[];
  limits: Record<string, unknown>;
  isPopular: boolean;
  sortOrder: number;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    name: "Jeriko Light",
    type: "free",
    description: "Get started with AI-powered tasks. 1,000 starter credits that never expire.",
    priceMonthly: 0,
    priceYearly: 0,
    discountYearlyPercent: 0,
    monthlyCredits: 0,
    starterCredits: 1000,
    dailyRefreshCredits: 300,
    maxConcurrentSessions: 1,
    maxParallelSubtasks: 5,
    maxScheduledTasks: 1,
    maxStepsPerSession: 15,
    features: [
      "1,000 starter credits (never expire)",
      "300 daily refresh credits",
      "1 concurrent task",
      "5 parallel subtasks",
      "1 scheduled task",
      "Chat mode (unlimited)",
      "Core agent capabilities",
    ],
    limits: {
      maxSessions: 1,
      maxAgents: 1,
      maxStorage: 500, // 500 MB
      maxTeamMembers: 0,
      maxProjects: 3,
      chatModeUnlimited: true,
      slidesGeneration: false,
      imageGeneration: false,
      videoGeneration: false,
      betaFeatures: false,
      prioritySupport: false,
    },
    isPopular: false,
    sortOrder: 0,
  },
  {
    name: "Jeriko Pro",
    type: "pro",
    description: "For professionals and power users. Dedicated resources and creative tools.",
    priceMonthly: 3900, // $39/mo
    priceYearly: 38868, // $388.68/yr = $32.39/mo (17% discount)
    discountYearlyPercent: 17,
    monthlyCredits: 3900,
    starterCredits: 1000,
    dailyRefreshCredits: 300,
    maxConcurrentSessions: 3,
    maxParallelSubtasks: 10,
    maxScheduledTasks: 3,
    maxStepsPerSession: 30,
    features: [
      "3,900 monthly credits",
      "300 daily refresh credits",
      "3 concurrent tasks",
      "10 parallel subtasks",
      "3 scheduled tasks",
      "Chat mode (unlimited)",
      "Full agent capabilities",
      "Image & slide generation",
      "Exclusive data sources",
      "Extended context length",
      "Priority access",
    ],
    limits: {
      maxSessions: 3,
      maxAgents: 5,
      maxStorage: 5000, // 5 GB
      maxTeamMembers: 0,
      maxProjects: 20,
      chatModeUnlimited: true,
      slidesGeneration: true,
      imageGeneration: true,
      videoGeneration: false,
      betaFeatures: false,
      prioritySupport: false,
    },
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: "Jeriko Max",
    type: "max",
    description: "Maximum power for demanding workflows. All features unlocked.",
    priceMonthly: 19900, // $199/mo
    priceYearly: 198204, // $1982.04/yr = $165.17/mo (17% discount)
    discountYearlyPercent: 17,
    monthlyCredits: 19900,
    starterCredits: 1000,
    dailyRefreshCredits: 300,
    maxConcurrentSessions: 10,
    maxParallelSubtasks: 20,
    maxScheduledTasks: 10,
    maxStepsPerSession: 50,
    features: [
      "19,900 monthly credits",
      "300 daily refresh credits",
      "10 concurrent tasks",
      "20 parallel subtasks",
      "10 scheduled tasks",
      "Chat mode (unlimited)",
      "Full agent capabilities",
      "Image, slide & video generation",
      "All data sources",
      "Maximum context length",
      "Priority support",
      "Beta feature access",
    ],
    limits: {
      maxSessions: 10,
      maxAgents: 20,
      maxStorage: 50000, // 50 GB
      maxTeamMembers: 0,
      maxProjects: 100,
      chatModeUnlimited: true,
      slidesGeneration: true,
      imageGeneration: true,
      videoGeneration: true,
      betaFeatures: true,
      prioritySupport: true,
    },
    isPopular: false,
    sortOrder: 2,
  },
];

/**
 * Tool credit costs — per-tool fixed costs matching Manus billing model.
 *
 * These cover:
 *   1. LLM token costs (charged via step metering, not here)
 *   2. Virtual machine / sandbox costs (charged per tool that uses sandbox)
 *   3. Third-party API costs (web search, image gen, etc.)
 */
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  // Browser tools — VM cost + page rendering
  browser_navigate: 3,
  browser_click: 1,
  browser_type: 1,
  browser_scroll: 1,
  browser_screenshot: 2,
  browser_wait: 1,
  browser_get_text: 2,
  browser_execute_js: 2,
  browser_tab_new: 1,
  browser_tab_close: 1,
  browser_tab_list: 1,
  browser_tab_switch: 1,
  browser_find_element: 1,
  browser_find_elements: 1,
  browser_hover: 1,
  browser_select: 1,
  browser_upload: 2,
  browser_download: 2,
  browser_cookies_get: 1,
  browser_cookies_set: 1,
  browser_network: 2,
  browser_console: 1,

  // File tools — sandbox I/O
  file_read: 1,
  file_write: 1,
  file_edit: 2,
  file_list: 1,
  file_delete: 1,
  file_move: 1,

  // Terminal / shell — VM execution
  shell_exec: 3,
  terminal_exec: 3,

  // Search — third-party API
  web_search: 5,

  // Code execution — VM compute
  code_execution: 3,
  code_exec: 3,

  // Image generation — expensive third-party API
  image_generation: 10,
  generate_image: 10,

  // Slides generation — compute + API
  create_slides: 8,

  // Deploy — VM + third-party
  deploy_website: 5,
  deploy_expose_port: 3,

  // Parallel tasks — billed per SUBTASK (each subtask is a separate LLM call)
  parallel_tasks: 0, // Parent tool is free; subtasks billed individually via step metering

  // File upload — storage
  file_upload: 2,

  // Email — third-party
  send_email: 5,
  draft_email: 3,

  // Text editor (Manus-style)
  text_editor: 2,

  // Show plan (UI only, no cost)
  show_plan: 0,
  showPlan: 0,

  // Message draft
  message_user: 0,
  message_draft: 0,

  // Sandbox management
  sandbox_create: 5,

  // Composio / connector tools — default cost for dynamic tools
  _composio_default: 3,
};

/**
 * Calculate credits for a step based on token usage.
 * Manus model: 1 credit per 1K input tokens, 3 credits per 1K output tokens.
 */
export function calculateStepCredits(inputTokens: number, outputTokens: number): number {
  const inputCredits = Math.ceil(inputTokens / 1000);
  const outputCredits = Math.ceil(outputTokens / 1000) * 3;
  return inputCredits + outputCredits;
}

/**
 * Known internal tool prefixes — these are NOT Composio dynamic tools.
 * Composio tools follow the pattern <app>_<action> where <app> is a
 * third-party service name (gmail, slack, github, notion, jira, etc.).
 */
const INTERNAL_TOOL_PREFIXES = [
  "browser_", "file_", "shell_", "terminal_", "code_", "web_",
  "image_", "generate_", "create_", "deploy_", "parallel_",
  "send_", "draft_", "text_", "show_", "message_", "sandbox_",
];

/**
 * Known Composio app prefixes — these are third-party connector apps.
 * Tools matching <composio_app>_<action> are charged at the Composio rate.
 */
const COMPOSIO_APP_PREFIXES = [
  "gmail_", "slack_", "github_", "notion_", "jira_", "linear_",
  "asana_", "trello_", "discord_", "twitter_", "hubspot_",
  "salesforce_", "zendesk_", "airtable_", "figma_", "dropbox_",
  "google_", "microsoft_", "outlook_", "calendar_", "sheets_",
  "drive_", "zoom_", "stripe_", "twilio_", "mailchimp_",
  "intercom_", "segment_", "amplitude_", "mixpanel_", "datadog_",
  "pagerduty_", "opsgenie_", "gitlab_", "bitbucket_", "vercel_",
  "netlify_", "supabase_", "firebase_", "aws_", "gcp_", "azure_",
  "composio_",
];

/**
 * Get tool credit cost. Returns 1 for unknown tools.
 */
export function getToolCreditCost(toolName: string): number {
  // Direct match
  if (toolName in TOOL_CREDIT_COSTS) {
    return TOOL_CREDIT_COSTS[toolName]!;
  }

  // Composio dynamic tools — must match a known Composio app prefix
  if (COMPOSIO_APP_PREFIXES.some((prefix) => toolName.startsWith(prefix))) {
    return TOOL_CREDIT_COSTS._composio_default ?? 3;
  }

  // Default: 1 credit for unknown tools
  return 1;
}

/**
 * Credit consumption order (Manus parity):
 *   1. Daily refresh credits (expire at midnight UTC)
 *   2. Monthly subscription credits (expire at period end)
 *   3. Purchased/add-on credits (never expire)
 *   4. Starter credits (never expire)
 *
 * Returns an array of { source, amount } describing how credits should be deducted.
 */
export interface CreditDeduction {
  source: "daily" | "monthly" | "purchased" | "starter";
  amount: number;
}

export function calculateCreditDeductions(
  required: number,
  balance: {
    dailyCredits: number;
    dailyCreditsUsed: number;
    periodCredits: number;
    periodCreditsUsed: number;
    purchasedCredits: number;
    purchasedCreditsUsed: number;
    starterCredits: number;
    starterCreditsUsed: number;
  }
): CreditDeduction[] {
  const deductions: CreditDeduction[] = [];
  let remaining = required;

  // 1. Daily credits
  const dailyAvailable = balance.dailyCredits - balance.dailyCreditsUsed;
  if (dailyAvailable > 0 && remaining > 0) {
    const fromDaily = Math.min(dailyAvailable, remaining);
    deductions.push({ source: "daily", amount: fromDaily });
    remaining -= fromDaily;
  }

  // 2. Monthly credits
  const monthlyAvailable = balance.periodCredits - balance.periodCreditsUsed;
  if (monthlyAvailable > 0 && remaining > 0) {
    const fromMonthly = Math.min(monthlyAvailable, remaining);
    deductions.push({ source: "monthly", amount: fromMonthly });
    remaining -= fromMonthly;
  }

  // 3. Purchased credits
  const purchasedAvailable = balance.purchasedCredits - balance.purchasedCreditsUsed;
  if (purchasedAvailable > 0 && remaining > 0) {
    const fromPurchased = Math.min(purchasedAvailable, remaining);
    deductions.push({ source: "purchased", amount: fromPurchased });
    remaining -= fromPurchased;
  }

  // 4. Starter credits
  const starterAvailable = balance.starterCredits - balance.starterCreditsUsed;
  if (starterAvailable > 0 && remaining > 0) {
    const fromStarter = Math.min(starterAvailable, remaining);
    deductions.push({ source: "starter", amount: fromStarter });
    remaining -= fromStarter;
  }

  return deductions;
}

/**
 * Default plan limits for free users (no subscription).
 */
export const FREE_PLAN_LIMITS = {
  maxConcurrentSessions: 1,
  maxParallelSubtasks: 5,
  maxScheduledTasks: 1,
  maxStepsPerSession: 15,
  dailyRefreshCredits: 300,
  starterCredits: 1000,
} as const;
