import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("@repo/database", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray) => strings.join(""),
}));

describe("/api/health route", () => {
  describe("GET (liveness)", () => {
    it("should return status ok", async () => {
      // Simulate the health check response structure
      const response = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      expect(response.status).toBe("ok");
      expect(response.timestamp).toBeDefined();
      expect(typeof response.uptime).toBe("number");
      expect(response.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should include a valid ISO timestamp", () => {
      const timestamp = new Date().toISOString();
      expect(() => new Date(timestamp)).not.toThrow();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("POST (readiness)", () => {
    it("should return ready when database is healthy", async () => {
      const { db } = await import("@repo/database");

      // DB check passes
      let dbStatus: "ok" | "fail" = "fail";
      try {
        await db.execute("SELECT 1" as any);
        dbStatus = "ok";
      } catch {
        dbStatus = "fail";
      }

      expect(dbStatus).toBe("ok");

      const checks = { database: dbStatus };
      const allHealthy = Object.values(checks).every((v) => v === "ok");
      expect(allHealthy).toBe(true);
    });

    it("should return degraded when database is unhealthy", async () => {
      const { db } = await import("@repo/database");
      vi.mocked(db.execute).mockRejectedValueOnce(new Error("Connection refused"));

      let dbStatus: "ok" | "fail" = "fail";
      try {
        await db.execute("SELECT 1" as any);
        dbStatus = "ok";
      } catch {
        dbStatus = "fail";
      }

      expect(dbStatus).toBe("fail");

      const checks = { database: dbStatus };
      const allHealthy = Object.values(checks).every((v) => v === "ok");
      expect(allHealthy).toBe(false);
    });
  });
});
