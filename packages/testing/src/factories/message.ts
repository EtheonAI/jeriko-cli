import { faker } from "@faker-js/faker";

export function createMockMessage(
  overrides: Partial<MockMessage> = {}
): MockMessage {
  const role = overrides.role ?? faker.helpers.arrayElement(["user", "assistant"] as const);
  return {
    id: faker.string.cuid2(),
    sessionId: faker.string.cuid2(),
    role,
    content:
      role === "user"
        ? faker.lorem.sentence()
        : faker.lorem.paragraphs({ min: 1, max: 3 }),
    parts: null,
    metadata: null,
    createdAt: faker.date.recent({ days: 1 }).toISOString(),
    ...overrides,
  };
}

export function createMockConversation(
  sessionId: string,
  turns: number
): MockMessage[] {
  const messages: MockMessage[] = [];
  let time = new Date(Date.now() - turns * 60000);

  for (let i = 0; i < turns; i++) {
    // User message
    messages.push(
      createMockMessage({
        sessionId,
        role: "user",
        createdAt: new Date(time.getTime()).toISOString(),
      })
    );
    time = new Date(time.getTime() + 30000);

    // Assistant message
    messages.push(
      createMockMessage({
        sessionId,
        role: "assistant",
        createdAt: new Date(time.getTime()).toISOString(),
      })
    );
    time = new Date(time.getTime() + 30000);
  }

  return messages;
}

export type MockMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts: Record<string, unknown>[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};
