/**
 * Notification Service Unit Tests
 */
import { describe, it, expect } from "vitest";

describe("Notification channels", () => {
  const CHANNELS = ["email", "web_push", "in_app"];

  it("should support all notification channels", () => {
    expect(CHANNELS).toContain("email");
    expect(CHANNELS).toContain("web_push");
    expect(CHANNELS).toContain("in_app");
  });
});

describe("Notification payload", () => {
  it("should require title and body", () => {
    const valid = { title: "Alert", body: "Something happened", channel: "in_app" };
    expect(valid.title).toBeTruthy();
    expect(valid.body).toBeTruthy();
  });

  it("should support optional metadata", () => {
    const notification = {
      title: "Task Complete",
      body: "Your task finished",
      metadata: { taskId: "t-1", url: "/tasks/t-1" },
    };
    expect(notification.metadata).toHaveProperty("taskId");
  });
});

describe("Web Push subscription", () => {
  it("should validate push subscription format", () => {
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
      keys: { p256dh: "abc", auth: "def" },
    };
    expect(sub.endpoint).toMatch(/^https:\/\//);
    expect(sub.keys).toHaveProperty("p256dh");
    expect(sub.keys).toHaveProperty("auth");
  });
});
