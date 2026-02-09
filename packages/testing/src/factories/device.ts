import { faker } from "@faker-js/faker";

const DEVICE_TYPES = [
  "sensor",
  "light",
  "switch",
  "climate",
  "lock",
  "camera",
  "media_player",
  "vacuum",
  "fan",
  "cover",
] as const;

const DEVICE_STATUSES = ["online", "offline", "error"] as const;

const HA_DOMAINS = [
  "light",
  "climate",
  "sensor",
  "binary_sensor",
  "switch",
  "media_player",
  "lock",
  "scene",
  "cover",
  "fan",
  "vacuum",
  "camera",
  "alarm_control_panel",
] as const;

export function createMockDevice(
  overrides: Partial<MockDevice> = {}
): MockDevice {
  return {
    id: faker.string.cuid2(),
    userId: faker.string.cuid2(),
    name: faker.commerce.productName(),
    type: faker.helpers.arrayElement(DEVICE_TYPES),
    status: "online",
    metadata: {
      firmware: `${faker.number.int({ min: 1, max: 5 })}.${faker.number.int({ min: 0, max: 9 })}.${faker.number.int({ min: 0, max: 9 })}`,
      manufacturer: faker.company.name(),
    },
    lastHeartbeat: faker.date.recent({ days: 1 }).toISOString(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockHub(overrides: Partial<MockHub> = {}): MockHub {
  return {
    id: faker.string.cuid2(),
    userId: faker.string.cuid2(),
    name: `Home Assistant - ${faker.location.city()}`,
    url: `http://${faker.internet.ip()}:8123`,
    accessToken: faker.string.alphanumeric(200),
    status: "connected",
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockEntity(
  overrides: Partial<MockEntity> = {}
): MockEntity {
  const domain = overrides.domain ?? faker.helpers.arrayElement(HA_DOMAINS);
  return {
    id: faker.string.cuid2(),
    hubId: faker.string.cuid2(),
    entityId: `${domain}.${faker.word.noun().toLowerCase()}_${faker.number.int({ min: 1, max: 99 })}`,
    domain,
    name: faker.commerce.productName(),
    state: domain === "light" ? "on" : domain === "sensor" ? "23.5" : "off",
    attributes: {},
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export type MockDevice = {
  id: string;
  userId: string;
  name: string;
  type: (typeof DEVICE_TYPES)[number];
  status: (typeof DEVICE_STATUSES)[number];
  metadata: Record<string, unknown> | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MockHub = {
  id: string;
  userId: string;
  name: string;
  url: string;
  accessToken: string;
  status: "connected" | "disconnected" | "error";
  createdAt: string;
  updatedAt: string;
};

export type MockEntity = {
  id: string;
  hubId: string;
  entityId: string;
  domain: (typeof HA_DOMAINS)[number];
  name: string;
  state: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
