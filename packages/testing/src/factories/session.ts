import { faker } from "@faker-js/faker";

export function createMockSession(
  overrides: Partial<MockSession> = {}
): MockSession {
  return {
    id: faker.string.cuid2(),
    userId: faker.string.cuid2(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    status: "active",
    metadata: null,
    createdAt: faker.date.recent({ days: 7 }).toISOString(),
    updatedAt: faker.date.recent({ days: 1 }).toISOString(),
    ...overrides,
  };
}

export function createMockSessionList(
  count: number,
  overrides: Partial<MockSession> = {}
): MockSession[] {
  return Array.from({ length: count }, () => createMockSession(overrides));
}

export type MockSession = {
  id: string;
  userId: string;
  title: string | null;
  status: "active" | "paused" | "completed" | "failed";
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};
