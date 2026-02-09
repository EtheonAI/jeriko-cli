import { faker } from "@faker-js/faker";

const APP_NAMES = [
  "github",
  "slack",
  "gmail",
  "google_calendar",
  "notion",
  "trello",
  "jira",
  "linear",
  "discord",
  "spotify",
  "twitter",
  "linkedin",
] as const;

const CONNECTION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "expired",
] as const;

export function createMockConnector(
  overrides: Partial<MockConnector> = {}
): MockConnector {
  return {
    id: faker.string.cuid2(),
    userId: faker.string.cuid2(),
    appName: faker.helpers.arrayElement(APP_NAMES),
    status: "connected",
    scopes: ["read", "write"],
    metadata: {},
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockConnectorApp(
  overrides: Partial<MockConnectorApp> = {}
): MockConnectorApp {
  const appName = overrides.appName ?? faker.helpers.arrayElement(APP_NAMES);
  return {
    id: faker.string.cuid2(),
    appName,
    displayName: appName.charAt(0).toUpperCase() + appName.slice(1).replace(/_/g, " "),
    description: faker.lorem.sentence(),
    icon: `https://cdn.rubic.dev/icons/${appName}.svg`,
    category: faker.helpers.arrayElement(["productivity", "communication", "development", "social", "entertainment"]),
    availableScopes: ["read", "write", "admin"],
    isEnabled: true,
    ...overrides,
  };
}

export function createMockComposioTool(
  overrides: Partial<MockComposioTool> = {}
): MockComposioTool {
  const appName = overrides.appName ?? faker.helpers.arrayElement(APP_NAMES);
  const action = overrides.action ?? faker.helpers.arrayElement(["send_message", "create_issue", "list_repos"]);

  return {
    name: `app_${appName}_${action}`,
    appName,
    action,
    description: faker.lorem.sentence(),
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Input value" },
      },
      required: ["input"],
    },
    ...overrides,
  };
}

export type MockConnector = {
  id: string;
  userId: string;
  appName: string;
  status: (typeof CONNECTION_STATUSES)[number];
  scopes: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MockConnectorApp = {
  id: string;
  appName: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  availableScopes: string[];
  isEnabled: boolean;
};

export type MockComposioTool = {
  name: string;
  appName: string;
  action: string;
  description: string;
  parameters: Record<string, unknown>;
};
