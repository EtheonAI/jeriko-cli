import type { TaskDefinition } from "../types.js";
import type { RuntimeContext } from "../runtime/dispatcher.js";

const BLOCKED_ACTIONS = new Set([
  "delete_data",
  "transfer_money",
  "change_security_settings",
  "expose_secrets",
  "bypass_captcha",
]);

const APPROVAL_HINTS = ["send", "publish", "post", "update", "submit", "refund", "charge"];

export async function enforceToolPermission(tool: string, task: TaskDefinition, ctx: RuntimeContext): Promise<void> {
  if (isBlocked(tool)) {
    throw new Error(`Blocked tool/action: ${tool}`);
  }

  if (needsApproval(tool) && task.requires_approval !== true) {
    throw new Error(`Tool ${tool} requires approval but task ${task.id} is not approval-gated.`);
  }

  // Real implementation checks:
  // - org/user connected account
  // - scopes
  // - workflow permissions
  // - approval_request row
  // - idempotency key
}

function isBlocked(tool: string): boolean {
  const lower = tool.toLowerCase();
  return [...BLOCKED_ACTIONS].some((a) => lower.includes(a));
}

function needsApproval(tool: string): boolean {
  const lower = tool.toLowerCase();
  return APPROVAL_HINTS.some((hint) => lower.includes(hint));
}
