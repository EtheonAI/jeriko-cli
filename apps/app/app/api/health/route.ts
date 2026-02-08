import { NextResponse } from "next/server";
import { db, sql } from "@repo/database";

/**
 * GET /api/health — Liveness probe
 * Returns 200 if the process is alive.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

/**
 * GET /api/health/ready — Readiness probe (separate route below)
 * Checks database connectivity.
 */
export async function POST() {
  const checks: Record<string, "ok" | "fail"> = {};

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allHealthy ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
