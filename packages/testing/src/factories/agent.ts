import { faker } from "@faker-js/faker";

const AGENT_TYPES = [
  "orchestrator",
  "researcher",
  "coder",
  "browser",
  "file_manager",
  "executor",
  "analyst",
] as const;

const AGENT_STATUSES = [
  "idle",
  "thinking",
  "executing",
  "waiting",
  "completed",
  "failed",
] as const;

export function createMockAgent(
  overrides: Partial<MockAgent> = {}
): MockAgent {
  return {
    id: faker.string.cuid2(),
    sessionId: faker.string.cuid2(),
    type: faker.helpers.arrayElement(AGENT_TYPES),
    name: faker.person.firstName() + " Agent",
    status: "idle",
    progress: 0,
    currentTask: null,
    lastActivity: faker.date.recent({ days: 1 }).toISOString(),
    metadata: null,
    createdAt: faker.date.recent({ days: 7 }).toISOString(),
    ...overrides,
  };
}

export function createMockAgentTask(
  overrides: Partial<MockAgentTask> = {}
): MockAgentTask {
  return {
    id: faker.string.cuid2(),
    agentId: faker.string.cuid2(),
    title: faker.hacker.phrase(),
    description: faker.lorem.sentence(),
    status: "pending",
    priority: faker.number.int({ min: 0, max: 10 }),
    parentTaskId: null,
    result: null,
    startedAt: null,
    completedAt: null,
    createdAt: faker.date.recent({ days: 1 }).toISOString(),
    ...overrides,
  };
}

export type MockAgent = {
  id: string;
  sessionId: string;
  type: (typeof AGENT_TYPES)[number];
  name: string | null;
  status: (typeof AGENT_STATUSES)[number];
  progress: number;
  currentTask: string | null;
  lastActivity: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type MockAgentTask = {
  id: string;
  agentId: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  priority: number;
  parentTaskId: string | null;
  result: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};
