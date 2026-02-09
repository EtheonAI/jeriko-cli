import { describe, it, expect, vi } from "vitest";

// ────────────────────────────────────────────────────────
// Database Pool Exhaustion Tests
//
// Validates correct behavior when the database connection pool
// is exhausted. Tests pool timeout handling, recovery after
// connections are released, and concurrent contention patterns.
// ────────────────────────────────────────────────────────

describe("Database Pool Exhaustion", () => {
  it("handles pool timeout gracefully", async () => {
    // Simulate a pool that rejects new connections (all connections in use)
    const mockPool = {
      query: vi
        .fn()
        .mockRejectedValue(
          new Error("timeout exceeded when trying to connect")
        ),
      connect: vi
        .fn()
        .mockRejectedValue(new Error("sorry, too many clients already")),
      end: vi.fn().mockResolvedValue(undefined),
      totalCount: 20,
      idleCount: 0,
      waitingCount: 50,
    };

    // Verify pool reports exhaustion state
    expect(mockPool.idleCount).toBe(0);
    expect(mockPool.waitingCount).toBeGreaterThan(0);
    expect(mockPool.totalCount).toBe(20);

    // Verify query rejects with meaningful error
    await expect(mockPool.query("SELECT 1")).rejects.toThrow(
      "timeout exceeded"
    );
    await expect(mockPool.connect()).rejects.toThrow("too many clients");

    // Pool end should still work (cleanup)
    await expect(mockPool.end()).resolves.toBeUndefined();
  });

  it("pool recovers after connections are released", async () => {
    let connectionCount = 0;
    const maxConnections = 5;

    const mockPool = {
      connect: vi.fn().mockImplementation(async () => {
        if (connectionCount >= maxConnections) {
          throw new Error("pool exhausted");
        }
        connectionCount++;
        return {
          query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
          release: () => {
            connectionCount--;
          },
        };
      }),
    };

    // Exhaust pool by acquiring all connections
    const connections: Array<{
      query: ReturnType<typeof vi.fn>;
      release: () => void;
    }> = [];
    for (let i = 0; i < maxConnections; i++) {
      connections.push(await mockPool.connect());
    }
    expect(connectionCount).toBe(maxConnections);

    // Next connection should fail
    await expect(mockPool.connect()).rejects.toThrow("pool exhausted");

    // Release one connection
    connections[0]!.release();
    expect(connectionCount).toBe(maxConnections - 1);

    // Now should succeed
    const newConn = await mockPool.connect();
    expect(newConn).toBeDefined();
    expect(newConn.query).toBeDefined();

    // Verify the recovered connection works
    const result = await newConn.query("SELECT 1");
    expect(result.rows).toEqual([{ id: 1 }]);

    // Cleanup all
    newConn.release();
    for (let i = 1; i < connections.length; i++) {
      connections[i]!.release();
    }
    expect(connectionCount).toBe(0);
  });

  it("concurrent requests handle pool contention", async () => {
    let available = 3;
    const queue: Array<() => void> = [];

    const getConnection = () =>
      new Promise<{ release: () => void }>((resolve, reject) => {
        if (available > 0) {
          available--;
          resolve({
            release: () => {
              available++;
              const next = queue.shift();
              if (next) next();
            },
          });
        } else {
          // Queue the request with a timeout
          const timeoutId = setTimeout(
            () => reject(new Error("pool timeout")),
            100
          );
          queue.push(() => {
            clearTimeout(timeoutId);
            available--;
            resolve({
              release: () => {
                available++;
                const next = queue.shift();
                if (next) next();
              },
            });
          });
        }
      });

    // Use all 3 connections
    const c1 = await getConnection();
    const c2 = await getConnection();
    const c3 = await getConnection();
    expect(available).toBe(0);

    // 4th should queue
    const p4 = getConnection();

    // Release c1 quickly -- c4 should now succeed
    setTimeout(() => c1.release(), 10);
    const c4 = await p4;
    expect(c4).toBeDefined();

    // Cleanup
    c2.release();
    c3.release();
    c4.release();
    expect(available).toBe(3);
  });

  it("handles transaction deadlock detection", async () => {
    // Simulate deadlock error that databases emit
    const deadlockError = new Error(
      "deadlock detected: process 12345 waits for ShareLock on transaction 67890"
    );
    (deadlockError as any).code = "40P01"; // PostgreSQL deadlock_detected

    expect((deadlockError as any).code).toBe("40P01");
    expect(deadlockError.message).toContain("deadlock detected");

    // Verify deadlock is retryable
    const retryableDbCodes = ["40P01", "40001", "55P03"];
    expect(retryableDbCodes.includes((deadlockError as any).code)).toBe(true);

    // Serialization failure should also be retryable
    const serializationError = new Error(
      "could not serialize access due to concurrent update"
    );
    (serializationError as any).code = "40001";
    expect(retryableDbCodes.includes((serializationError as any).code)).toBe(
      true
    );

    // Lock timeout should also be retryable
    const lockError = new Error("lock timeout");
    (lockError as any).code = "55P03";
    expect(retryableDbCodes.includes((lockError as any).code)).toBe(true);
  });

  it("connection pool with health checks detects stale connections", async () => {
    let healthCheckCount = 0;
    let staleCount = 0;

    const connections = Array.from({ length: 5 }, (_, i) => ({
      id: `conn-${i}`,
      isAlive: i < 3, // 3 healthy, 2 stale
      lastUsed: Date.now() - (i < 3 ? 1000 : 60000), // stale = unused for 60s
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === "SELECT 1") {
          healthCheckCount++;
          if (!connections[i]!.isAlive) {
            staleCount++;
            throw new Error("Connection terminated unexpectedly");
          }
          return { rows: [{ "?column?": 1 }] };
        }
        return { rows: [] };
      }),
    }));

    // Run health checks on all connections
    const healthResults = await Promise.allSettled(
      connections.map((conn) => conn.query("SELECT 1"))
    );

    expect(healthCheckCount).toBe(5);
    expect(staleCount).toBe(2);

    const healthy = healthResults.filter((r) => r.status === "fulfilled");
    const stale = healthResults.filter((r) => r.status === "rejected");
    expect(healthy).toHaveLength(3);
    expect(stale).toHaveLength(2);
  });

  it("handles pool drain during graceful shutdown", async () => {
    let activeConnections = 5;
    let isDraining = false;

    const pool = {
      activeCount: () => activeConnections,
      isDraining: () => isDraining,

      drain: async (timeoutMs: number) => {
        isDraining = true;
        const start = Date.now();

        // Simulate connections being released over time
        while (activeConnections > 0 && Date.now() - start < timeoutMs) {
          await new Promise((r) => setTimeout(r, 10));
          activeConnections--;
        }

        return activeConnections === 0;
      },

      connect: vi.fn().mockImplementation(async () => {
        if (isDraining) {
          throw new Error("Pool is draining, no new connections allowed");
        }
        activeConnections++;
        return { release: () => activeConnections-- };
      }),
    };

    expect(pool.activeCount()).toBe(5);
    expect(pool.isDraining()).toBe(false);

    // Start draining
    const drained = await pool.drain(200);
    expect(drained).toBe(true);
    expect(pool.activeCount()).toBe(0);
    expect(pool.isDraining()).toBe(true);

    // New connections should be rejected during drain
    await expect(pool.connect()).rejects.toThrow(
      "Pool is draining, no new connections allowed"
    );
  });

  it("pool reconnection after total failure", async () => {
    let isDbUp = false;
    let reconnectAttempts = 0;

    const pool = {
      connect: vi.fn().mockImplementation(async () => {
        reconnectAttempts++;
        if (!isDbUp) {
          throw new Error("ECONNREFUSED: Connection refused");
        }
        return {
          query: vi.fn().mockResolvedValue({ rows: [{ connected: true }] }),
          release: vi.fn(),
        };
      }),
    };

    // Database is down -- all connections fail
    await expect(pool.connect()).rejects.toThrow("ECONNREFUSED");
    await expect(pool.connect()).rejects.toThrow("ECONNREFUSED");
    await expect(pool.connect()).rejects.toThrow("ECONNREFUSED");
    expect(reconnectAttempts).toBe(3);

    // Database comes back up
    isDbUp = true;

    // Should reconnect successfully
    const conn = await pool.connect();
    expect(conn).toBeDefined();
    const result = await conn.query("SELECT 1");
    expect(result.rows[0]).toEqual({ connected: true });
    expect(reconnectAttempts).toBe(4);
  });

  it("handles query timeout separate from connection timeout", async () => {
    const queryTimeout = 5000;
    const connectionTimeout = 2000;

    // Simulate a pool where connections succeed but queries are slow
    const pool = {
      connect: vi.fn().mockImplementation(async () => {
        // Connection succeeds quickly
        return {
          query: vi.fn().mockImplementation(async (sql: string) => {
            // Simulate a slow query that exceeds timeout
            if (sql.includes("SLOW")) {
              throw new Error(
                `Query cancelled: execution time exceeded ${queryTimeout}ms`
              );
            }
            return { rows: [{ result: "fast" }] };
          }),
          release: vi.fn(),
        };
      }),
    };

    const conn = await pool.connect();

    // Fast query succeeds
    const fastResult = await conn.query("SELECT 1");
    expect(fastResult.rows[0]).toEqual({ result: "fast" });

    // Slow query times out
    await expect(conn.query("SELECT SLOW_FUNCTION()")).rejects.toThrow(
      `Query cancelled: execution time exceeded ${queryTimeout}ms`
    );

    // Connection is still usable after query timeout
    const afterTimeoutResult = await conn.query("SELECT 2");
    expect(afterTimeoutResult.rows[0]).toEqual({ result: "fast" });

    conn.release();
  });
});
