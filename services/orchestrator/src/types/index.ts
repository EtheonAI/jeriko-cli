export interface FeatureFlags {
  pythonExecutor: boolean;
  nodeExecutor: boolean;
  shadowMode: boolean;
}

export interface ShadowMetrics {
  planToolCalls: number;
  scheduleToolCalls: number;
  contextSize: number;
  skillsLoaded: number;
  timestamp: string;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  tools: string[];
  skills: string[];
  mode?: "plan" | "execute" | "normal";
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  timestamp: string;
  event: string;
  metadata?: Record<string, unknown>;
}

export interface PromptContext {
  systemPrompt: string;
  userContext: string;
  tools: unknown[];
  compactedHistory?: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  handler?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
