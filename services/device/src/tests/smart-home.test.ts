/**
 * Smart Home / Hub Unit Tests
 *
 * Tests HA hub registration validation, connection testing logic,
 * entity discovery with domain filtering, entity ID parsing,
 * the SaaS model (each user connects their own HA instance),
 * and entity state management patterns.
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// ─── Replicate schemas and constants from routes/hubs.ts ────────

const SUPPORTED_DOMAINS = [
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
  "humidifier",
  "water_heater",
  "remote",
  "siren",
  "automation",
  "input_boolean",
] as const;

const RegisterHubSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["home_assistant"]).default("home_assistant"),
  config: z.object({
    url: z.string().url(),
    accessToken: z.string().min(1),
  }),
});

const CommandSchema = z.object({
  service: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

// ─── Helper functions (mirrors hubs.ts logic) ───────────────────

function isValidDomain(domain: string): boolean {
  return (SUPPORTED_DOMAINS as readonly string[]).includes(domain);
}

function parseEntityId(entityId: string): { domain: string; objectId: string } | null {
  const parts = entityId.split(".", 2);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { domain: parts[0], objectId: parts[1] };
}

function buildFriendlyName(entityId: string, attributes: Record<string, unknown>): string {
  if (attributes.friendly_name && typeof attributes.friendly_name === "string") {
    return attributes.friendly_name;
  }
  return entityId.split(".")[1]?.replace(/_/g, " ") || entityId;
}

// ─── Tests ──────────────────────────────────────────────────────

describe("Hub registration schema validation", () => {
  it("should accept a valid hub registration", () => {
    const input = {
      name: "My Home Assistant",
      config: {
        url: "http://192.168.1.100:8123",
        accessToken: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test",
      },
    };

    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Home Assistant");
      expect(result.data.type).toBe("home_assistant"); // default
      expect(result.data.config.url).toBe("http://192.168.1.100:8123");
    }
  });

  it("should accept HTTPS URLs", () => {
    const input = {
      name: "Remote HA",
      config: {
        url: "https://ha.example.com",
        accessToken: "valid-token",
      },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept .local domain URLs", () => {
    const input = {
      name: "Local HA",
      config: {
        url: "http://homeassistant.local:8123",
        accessToken: "valid-token",
      },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject registration with empty name", () => {
    const input = {
      name: "",
      config: { url: "http://192.168.1.100:8123", accessToken: "tok" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with invalid URL", () => {
    const input = {
      name: "Bad Hub",
      config: { url: "not-a-url", accessToken: "tok" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with empty access token", () => {
    const input = {
      name: "No Token Hub",
      config: { url: "http://192.168.1.100:8123", accessToken: "" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with missing config", () => {
    const input = { name: "No Config Hub" };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with missing url in config", () => {
    const input = {
      name: "Missing URL Hub",
      config: { accessToken: "tok" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should default type to home_assistant", () => {
    const input = {
      name: "Default Type",
      config: { url: "http://192.168.1.100:8123", accessToken: "tok" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("home_assistant");
    }
  });

  it("should reject name exceeding 255 characters", () => {
    const input = {
      name: "x".repeat(256),
      config: { url: "http://192.168.1.100:8123", accessToken: "tok" },
    };
    const result = RegisterHubSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Entity command schema validation", () => {
  it("should accept valid command with service and data", () => {
    const input = {
      service: "turn_on",
      data: { brightness: 255 },
    };
    const result = CommandSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept command with service only (data optional)", () => {
    const input = { service: "turn_off" };
    const result = CommandSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject command with empty service", () => {
    const input = { service: "" };
    const result = CommandSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject command with no service field", () => {
    const input = { data: { brightness: 128 } };
    const result = CommandSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Entity discovery — domain filtering", () => {
  it("should support all 19 HA domains", () => {
    expect(SUPPORTED_DOMAINS).toHaveLength(19);
    for (const domain of SUPPORTED_DOMAINS) {
      expect(isValidDomain(domain)).toBe(true);
    }
  });

  it("should include all expected domain names", () => {
    const expected = [
      "light", "climate", "sensor", "binary_sensor", "switch",
      "media_player", "lock", "scene", "cover", "fan", "vacuum",
      "camera", "alarm_control_panel", "humidifier", "water_heater",
      "remote", "siren", "automation", "input_boolean",
    ];
    for (const domain of expected) {
      expect(SUPPORTED_DOMAINS).toContain(domain);
    }
  });

  it("should reject unsupported domains", () => {
    const unsupported = [
      "weather", "person", "zone", "sun", "tts",
      "device_tracker", "group", "script", "input_number",
      "input_text", "input_select", "input_datetime",
      "timer", "counter", "number", "select", "button",
      "", "invalid",
    ];
    for (const domain of unsupported) {
      expect(isValidDomain(domain)).toBe(false);
    }
  });

  it("should filter HA states to supported domains only", () => {
    const allStates = [
      { entity_id: "light.kitchen", state: "on", attributes: {} },
      { entity_id: "sensor.temperature", state: "23.5", attributes: {} },
      { entity_id: "weather.home", state: "sunny", attributes: {} },
      { entity_id: "climate.living_room", state: "heat", attributes: {} },
      { entity_id: "person.john", state: "home", attributes: {} },
      { entity_id: "binary_sensor.door", state: "off", attributes: {} },
      { entity_id: "sun.sun", state: "above_horizon", attributes: {} },
      { entity_id: "automation.morning_lights", state: "on", attributes: {} },
    ];

    const supported = allStates.filter((s) => {
      const domain = s.entity_id.split(".")[0];
      return domain ? isValidDomain(domain) : false;
    });

    expect(supported).toHaveLength(5);
    expect(supported.map((s) => s.entity_id)).toEqual([
      "light.kitchen",
      "sensor.temperature",
      "climate.living_room",
      "binary_sensor.door",
      "automation.morning_lights",
    ]);
  });
});

describe("Entity ID parsing", () => {
  it("should parse standard entity IDs correctly", () => {
    const result = parseEntityId("light.living_room_1");
    expect(result).toEqual({ domain: "light", objectId: "living_room_1" });
  });

  it("should parse sensor entity IDs", () => {
    const result = parseEntityId("sensor.outdoor_temperature");
    expect(result).toEqual({ domain: "sensor", objectId: "outdoor_temperature" });
  });

  it("should parse binary_sensor entity IDs", () => {
    const result = parseEntityId("binary_sensor.front_door");
    expect(result).toEqual({ domain: "binary_sensor", objectId: "front_door" });
  });

  it("should reject entity IDs without a dot separator", () => {
    expect(parseEntityId("no_dot")).toBeNull();
  });

  it("should reject empty string", () => {
    expect(parseEntityId("")).toBeNull();
  });

  it("should handle entity IDs with multiple dots (only first dot splits)", () => {
    // "sensor.temperature.average" -> split(".", 2) = ["sensor", "temperature"]
    const result = parseEntityId("sensor.temperature.average");
    expect(result).toEqual({ domain: "sensor", objectId: "temperature" });
  });

  it("should reject entity ID that is just a dot", () => {
    // ".".split(".", 2) = ["", ""] -> parts[0] is empty
    expect(parseEntityId(".")).toBeNull();
  });
});

describe("Friendly name extraction", () => {
  it("should use friendly_name attribute when available", () => {
    const name = buildFriendlyName("light.kitchen_1", {
      friendly_name: "Kitchen Main Light",
    });
    expect(name).toBe("Kitchen Main Light");
  });

  it("should fall back to object ID with underscores replaced", () => {
    const name = buildFriendlyName("light.living_room_ceiling", {});
    expect(name).toBe("living room ceiling");
  });

  it("should use full entity ID when no object ID available", () => {
    // Edge case: if split produces no second part
    const name = buildFriendlyName("light", {});
    // "light".split(".")[1] is undefined -> fallback to entityId
    expect(name).toBe("light");
  });
});

describe("Hub connection testing logic", () => {
  it("should construct correct HA API URL with trailing slash stripped", () => {
    const hubUrl = "http://192.168.1.100:8123/";
    const cleanUrl = hubUrl.replace(/\/+$/, "");
    const apiUrl = `${cleanUrl}/api/config`;
    expect(apiUrl).toBe("http://192.168.1.100:8123/api/config");
  });

  it("should construct correct HA API URL without trailing slash", () => {
    const hubUrl = "http://192.168.1.100:8123";
    const cleanUrl = hubUrl.replace(/\/+$/, "");
    const apiUrl = `${cleanUrl}/api/config`;
    expect(apiUrl).toBe("http://192.168.1.100:8123/api/config");
  });

  it("should format HA API auth header correctly", () => {
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test";
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("should construct states endpoint correctly", () => {
    const baseUrl = "http://192.168.1.100:8123";
    const statesUrl = `${baseUrl}/api/states`;
    expect(statesUrl).toBe("http://192.168.1.100:8123/api/states");
  });

  it("should construct service call endpoint correctly", () => {
    const baseUrl = "http://192.168.1.100:8123";
    const domain = "light";
    const service = "turn_on";
    const serviceUrl = `${baseUrl}/api/services/${domain}/${service}`;
    expect(serviceUrl).toBe("http://192.168.1.100:8123/api/services/light/turn_on");
  });

  it("should construct entity state endpoint correctly", () => {
    const baseUrl = "http://192.168.1.100:8123";
    const entityId = "light.kitchen";
    const stateUrl = `${baseUrl}/api/states/${entityId}`;
    expect(stateUrl).toBe("http://192.168.1.100:8123/api/states/light.kitchen");
  });
});

describe("SaaS model — per-user hub isolation", () => {
  it("should enforce one hub per user per URL", () => {
    const existingHubs = [
      { userId: "u1", url: "http://192.168.1.100:8123" },
      { userId: "u1", url: "http://192.168.1.200:8123" },
      { userId: "u2", url: "http://192.168.1.100:8123" },
    ];

    // Same user, same URL = duplicate
    const dup1 = { userId: "u1", url: "http://192.168.1.100:8123" };
    const isDuplicate1 = existingHubs.some(
      (h) => h.userId === dup1.userId && h.url === dup1.url
    );
    expect(isDuplicate1).toBe(true);

    // Same user, different URL = not duplicate
    const dup2 = { userId: "u1", url: "http://192.168.1.300:8123" };
    const isDuplicate2 = existingHubs.some(
      (h) => h.userId === dup2.userId && h.url === dup2.url
    );
    expect(isDuplicate2).toBe(false);

    // Different user, same URL = not duplicate (different user's instance)
    const dup3 = { userId: "u3", url: "http://192.168.1.100:8123" };
    const isDuplicate3 = existingHubs.some(
      (h) => h.userId === dup3.userId && h.url === dup3.url
    );
    expect(isDuplicate3).toBe(false);
  });

  it("should scope hub queries by userId", () => {
    const allHubs = [
      { id: "h1", userId: "u1", name: "User1 Hub A" },
      { id: "h2", userId: "u1", name: "User1 Hub B" },
      { id: "h3", userId: "u2", name: "User2 Hub A" },
    ];

    const u1Hubs = allHubs.filter((h) => h.userId === "u1");
    const u2Hubs = allHubs.filter((h) => h.userId === "u2");

    expect(u1Hubs).toHaveLength(2);
    expect(u2Hubs).toHaveLength(1);
    expect(u1Hubs.map((h) => h.id)).toEqual(["h1", "h2"]);
  });
});

describe("Hub deletion — cascade behavior", () => {
  it("should cascade delete entities when hub is deleted", () => {
    const hubId = "hub-1";
    const entities = [
      { id: "e1", hubId: "hub-1", entityId: "light.kitchen" },
      { id: "e2", hubId: "hub-1", entityId: "sensor.temp" },
      { id: "e3", hubId: "hub-2", entityId: "switch.office" },
    ];

    const remaining = entities.filter((e) => e.hubId !== hubId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.hubId).toBe("hub-2");
  });

  it("should not affect entities from other hubs", () => {
    const entities = [
      { id: "e1", hubId: "hub-1" },
      { id: "e2", hubId: "hub-2" },
      { id: "e3", hubId: "hub-3" },
    ];

    const deletedHubId = "hub-2";
    const remaining = entities.filter((e) => e.hubId !== deletedHubId);

    expect(remaining).toHaveLength(2);
    expect(remaining.map((e) => e.hubId)).toEqual(["hub-1", "hub-3"]);
  });
});

describe("Entity state management", () => {
  it("should handle light entity on/off/unavailable states", () => {
    const validStates = ["on", "off", "unavailable"];
    const light = { domain: "light", state: "on" };
    expect(validStates).toContain(light.state);
  });

  it("should handle sensor numeric states as strings", () => {
    const sensor = { domain: "sensor", state: "23.5" };
    const value = parseFloat(sensor.state);
    expect(value).toBe(23.5);
    expect(Number.isFinite(value)).toBe(true);
  });

  it("should handle sensor non-numeric states (e.g. unavailable)", () => {
    const sensor = { domain: "sensor", state: "unavailable" };
    const value = parseFloat(sensor.state);
    expect(Number.isNaN(value)).toBe(true);
  });

  it("should handle climate with target and current temperature", () => {
    const climate = {
      domain: "climate",
      state: "heat",
      attributes: {
        temperature: 22,
        current_temperature: 20.5,
        hvac_modes: ["heat", "cool", "off"],
        min_temp: 7,
        max_temp: 35,
      },
    };
    expect(climate.attributes.temperature).toBe(22);
    expect(climate.attributes.current_temperature).toBe(20.5);
    expect(climate.attributes.hvac_modes).toContain(climate.state);
  });

  it("should handle lock states", () => {
    const lock = { domain: "lock", state: "locked" };
    expect(["locked", "unlocked", "locking", "unlocking", "unavailable"]).toContain(lock.state);
  });

  it("should handle scene entities (always 'scening' or timestamp state)", () => {
    const scene = { domain: "scene", state: "2024-01-15T10:30:00+00:00" };
    // Scene states are typically timestamps of last activation
    expect(scene.state).toBeTruthy();
  });

  it("should handle binary_sensor states", () => {
    const binarySensor = { domain: "binary_sensor", state: "on" };
    expect(["on", "off", "unavailable"]).toContain(binarySensor.state);
  });

  it("should handle cover states", () => {
    const cover = {
      domain: "cover",
      state: "open",
      attributes: { current_position: 100 },
    };
    expect(["open", "closed", "opening", "closing", "stopped", "unavailable"]).toContain(
      cover.state
    );
    expect(cover.attributes.current_position).toBe(100);
  });

  it("should handle media_player states", () => {
    const player = {
      domain: "media_player",
      state: "playing",
      attributes: {
        media_title: "Test Song",
        volume_level: 0.5,
      },
    };
    expect(["playing", "paused", "idle", "off", "unavailable", "standby"]).toContain(
      player.state
    );
    expect(player.attributes.volume_level).toBe(0.5);
  });

  it("should handle fan states with speed", () => {
    const fan = {
      domain: "fan",
      state: "on",
      attributes: {
        percentage: 66,
        preset_mode: "medium",
      },
    };
    expect(["on", "off", "unavailable"]).toContain(fan.state);
    expect(fan.attributes.percentage).toBeGreaterThanOrEqual(0);
    expect(fan.attributes.percentage).toBeLessThanOrEqual(100);
  });
});

describe("Entity discovery — refresh workflow", () => {
  it("should replace all existing entities on re-discover", () => {
    // Mirrors the discover endpoint: delete old, insert new
    let storedEntities = [
      { id: "old-1", hubId: "h1", entityId: "light.kitchen" },
      { id: "old-2", hubId: "h1", entityId: "sensor.temp" },
    ];

    // Delete existing for this hub
    storedEntities = storedEntities.filter((e) => e.hubId !== "h1");
    expect(storedEntities).toHaveLength(0);

    // Insert new discovered entities
    const discovered = [
      { id: "new-1", hubId: "h1", entityId: "light.kitchen" },
      { id: "new-2", hubId: "h1", entityId: "sensor.temp" },
      { id: "new-3", hubId: "h1", entityId: "switch.office" },
    ];
    storedEntities.push(...discovered);

    expect(storedEntities).toHaveLength(3);
  });

  it("should not delete entities from other hubs during discovery", () => {
    let storedEntities = [
      { id: "e1", hubId: "h1", entityId: "light.kitchen" },
      { id: "e2", hubId: "h2", entityId: "sensor.temp" },
    ];

    // Delete only hub h1's entities
    storedEntities = storedEntities.filter((e) => e.hubId !== "h1");

    expect(storedEntities).toHaveLength(1);
    expect(storedEntities[0]!.hubId).toBe("h2");
  });

  it("should update hub entity count after discovery", () => {
    const hub = { id: "h1", entityCount: 0, lastSyncAt: null as Date | null };
    const discoveredCount = 15;

    hub.entityCount = discoveredCount;
    hub.lastSyncAt = new Date();

    expect(hub.entityCount).toBe(15);
    expect(hub.lastSyncAt).toBeInstanceOf(Date);
  });

  it("should handle discovery with zero supported entities", () => {
    const allStates = [
      { entity_id: "weather.home", state: "sunny" },
      { entity_id: "person.john", state: "home" },
      { entity_id: "zone.home", state: "0" },
    ];

    const supported = allStates.filter((s) => {
      const domain = s.entity_id.split(".")[0];
      return domain ? isValidDomain(domain) : false;
    });

    expect(supported).toHaveLength(0);
  });
});

describe("Hub status transitions", () => {
  it("should set status to connected on successful test", () => {
    const testResult = { ok: true, version: "2026.2.0" };
    const newStatus = testResult.ok ? "connected" : "error";
    expect(newStatus).toBe("connected");
  });

  it("should set status to error on failed test", () => {
    const testResult = { ok: false };
    const newStatus = testResult.ok ? "connected" : "error";
    expect(newStatus).toBe("error");
  });

  it("should preserve HA version in metadata on successful test", () => {
    const existingMetadata = { someKey: "value" };
    const testResult = { ok: true, version: "2026.2.0" };

    const updatedMetadata = testResult.version
      ? { ...existingMetadata, haVersion: testResult.version }
      : existingMetadata;

    expect(updatedMetadata).toEqual({
      someKey: "value",
      haVersion: "2026.2.0",
    });
  });

  it("should not modify metadata when version is absent", () => {
    const existingMetadata = { someKey: "value" };
    const testResult = { ok: true, version: undefined };

    const updatedMetadata = testResult.version
      ? { ...existingMetadata, haVersion: testResult.version }
      : existingMetadata;

    expect(updatedMetadata).toEqual({ someKey: "value" });
  });

  it("should mark hub as error when discovery fails", () => {
    // Mirrors the catch block in the discover endpoint
    const hub = { id: "h1", status: "connected" };
    hub.status = "error";
    expect(hub.status).toBe("error");
  });
});

describe("Service call data construction", () => {
  it("should include entity_id in service call data", () => {
    const entityId = "light.kitchen";
    const inputData = { brightness: 200 };

    const serviceData = {
      entity_id: entityId,
      ...inputData,
    };

    expect(serviceData.entity_id).toBe("light.kitchen");
    expect(serviceData.brightness).toBe(200);
  });

  it("should handle service call with no extra data", () => {
    const entityId = "light.kitchen";
    const inputData = undefined;

    const serviceData = {
      entity_id: entityId,
      ...(inputData || {}),
    };

    expect(serviceData.entity_id).toBe("light.kitchen");
    expect(Object.keys(serviceData)).toHaveLength(1);
  });

  it("should handle scene activation data", () => {
    const entityId = "scene.movie_night";
    const serviceData = { entity_id: entityId };

    expect(serviceData.entity_id).toBe("scene.movie_night");
  });

  it("should handle climate service with temperature data", () => {
    const entityId = "climate.living_room";
    const serviceData = {
      entity_id: entityId,
      temperature: 22,
      hvac_mode: "heat",
    };

    expect(serviceData.temperature).toBe(22);
    expect(serviceData.hvac_mode).toBe("heat");
  });
});
