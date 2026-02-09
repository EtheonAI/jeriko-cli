/**
 * Minimal seed data for integration tests.
 *
 * Usage:
 *   import { seedData, SEED_USER_ID, SEED_SESSION_ID } from "@repo/testing/db/seed";
 */
import { faker } from "@faker-js/faker";

export const SEED_USER_ID = "seed-user-001";
export const SEED_SESSION_ID = "seed-session-001";
export const SEED_DEVICE_ID = "seed-device-001";
export const SEED_FILE_ID = "seed-file-001";
export const SEED_CONNECTOR_ID = "seed-connector-001";
export const SEED_HUB_ID = "seed-hub-001";

export const seedData = {
  user: {
    id: SEED_USER_ID,
    name: "Test User",
    email: "test@rubic.dev",
    image: null,
    emailVerified: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  session: {
    id: SEED_SESSION_ID,
    userId: SEED_USER_ID,
    title: "Test Session",
    status: "active" as const,
    metadata: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  device: {
    id: SEED_DEVICE_ID,
    userId: SEED_USER_ID,
    name: "Test Device",
    type: "sensor",
    status: "online",
    metadata: { firmware: "1.0.0" },
    lastHeartbeat: new Date(),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  file: {
    id: SEED_FILE_ID,
    userId: SEED_USER_ID,
    sessionId: SEED_SESSION_ID,
    name: "test-file.txt",
    path: "/",
    mimeType: "text/plain",
    size: 1024,
    storageKey: `${SEED_USER_ID}/${SEED_FILE_ID}/test-file.txt`,
    storageProvider: "s3",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  connector: {
    id: SEED_CONNECTOR_ID,
    userId: SEED_USER_ID,
    appName: "github",
    status: "connected",
    scopes: ["repo", "user"],
    metadata: {},
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  hub: {
    id: SEED_HUB_ID,
    userId: SEED_USER_ID,
    name: "Test Home Assistant",
    url: "http://localhost:8123",
    accessToken: "test-ha-token",
    status: "connected",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  messages: [
    {
      id: faker.string.cuid2(),
      sessionId: SEED_SESSION_ID,
      role: "user" as const,
      content: "Hello, how are you?",
      parts: null,
      metadata: null,
      createdAt: new Date("2026-01-01T10:00:00"),
    },
    {
      id: faker.string.cuid2(),
      sessionId: SEED_SESSION_ID,
      role: "assistant" as const,
      content: "I'm doing well! How can I help you today?",
      parts: null,
      metadata: null,
      createdAt: new Date("2026-01-01T10:00:05"),
    },
  ],
};
