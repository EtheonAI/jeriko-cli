import { db, sql } from "@repo/database";

type HealthStatus = "degraded" | "ok" | "ready";
type CheckStatus = "fail" | "ok";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok" satisfies HealthStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export async function POST() {
  const checks: Record<string, CheckStatus> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return Response.json(
    {
      status: (allHealthy ? "ready" : "degraded") satisfies HealthStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
