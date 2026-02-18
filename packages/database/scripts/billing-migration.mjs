/**
 * Billing Migration + Plan Seed Script
 *
 * Run with:
 *   node packages/database/scripts/billing-migration.mjs
 *   (DATABASE_URL is loaded from packages/database/.env)
 */

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

// Load .env manually
const envPath = new URL("../.env", import.meta.url).pathname;
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  if (line.startsWith("#") || !line.includes("=")) continue;
  const [key, ...rest] = line.split("=");
  process.env[key.trim()] = rest.join("=").trim();
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("=== Billing Migration + Plan Seed ===\n");

  // ── 1. subscription_plans: add Manus parity columns ──────────────────────
  console.log("1. Adding columns to subscription_plans...");
  const planColumns = [
    { name: "starter_credits", type: "integer DEFAULT 0 NOT NULL" },
    { name: "daily_refresh_credits", type: "integer DEFAULT 0 NOT NULL" },
    { name: "max_concurrent_sessions", type: "integer DEFAULT 1 NOT NULL" },
    { name: "max_parallel_subtasks", type: "integer DEFAULT 5 NOT NULL" },
    { name: "max_scheduled_tasks", type: "integer DEFAULT 1 NOT NULL" },
    { name: "max_steps_per_session", type: "integer DEFAULT 25 NOT NULL" },
  ];

  for (const col of planColumns) {
    try {
      await sql(`ALTER TABLE subscription_plans ADD COLUMN ${col.name} ${col.type}`);
      console.log(`   + ${col.name}`);
    } catch (e) {
      if (e.message?.includes("already exists")) {
        console.log(`   ~ ${col.name} (already exists)`);
      } else {
        throw e;
      }
    }
  }

  // ── 2. credit_balances: add daily/starter/purchased tracking ─────────────
  console.log("\n2. Adding columns to credit_balances...");
  const balanceColumns = [
    { name: "daily_credits", type: "integer DEFAULT 0 NOT NULL" },
    { name: "daily_credits_used", type: "integer DEFAULT 0 NOT NULL" },
    { name: "daily_refresh_amount", type: "integer DEFAULT 300 NOT NULL" },
    { name: "last_daily_refresh_at", type: "timestamp" },
    { name: "starter_credits", type: "integer DEFAULT 0 NOT NULL" },
    { name: "starter_credits_used", type: "integer DEFAULT 0 NOT NULL" },
    { name: "purchased_credits_used", type: "integer DEFAULT 0 NOT NULL" },
  ];

  for (const col of balanceColumns) {
    try {
      await sql(`ALTER TABLE credit_balances ADD COLUMN ${col.name} ${col.type}`);
      console.log(`   + ${col.name}`);
    } catch (e) {
      if (e.message?.includes("already exists")) {
        console.log(`   ~ ${col.name} (already exists)`);
      } else {
        throw e;
      }
    }
  }

  // ── 3. Create usage_ledger table ─────────────────────────────────────────
  console.log("\n3. Creating usage_ledger table...");
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS usage_ledger (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        session_id text,
        step_id text,
        tool_name text,
        credits_charged integer DEFAULT 0 NOT NULL,
        input_tokens integer,
        output_tokens integer,
        model text,
        balance_before integer,
        balance_after integer,
        metadata jsonb,
        recorded_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log("   + usage_ledger created (or already exists)");
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("   ~ usage_ledger (already exists)");
    } else {
      throw e;
    }
  }

  // ── 4. Seed the 3 plan definitions ───────────────────────────────────────
  console.log("\n4. Seeding plan definitions...");

  const plans = [
    {
      name: "Rubic Light",
      type: "free",
      description: "Get started with AI-powered tasks. 1,000 starter credits that never expire.",
      price_monthly: 0,
      price_yearly: 0,
      discount_yearly_percent: 0,
      monthly_credits: 0,
      starter_credits: 1000,
      daily_refresh_credits: 300,
      max_concurrent_sessions: 1,
      max_parallel_subtasks: 5,
      max_scheduled_tasks: 1,
      max_steps_per_session: 15,
      features: JSON.stringify([
        "1,000 starter credits (never expire)",
        "300 daily refresh credits",
        "1 concurrent task",
        "5 parallel subtasks",
        "1 scheduled task",
        "Chat mode (unlimited)",
        "Core agent capabilities",
      ]),
      limits: JSON.stringify({
        maxSessions: 1, maxAgents: 1, maxStorage: 500, maxTeamMembers: 0, maxProjects: 3,
        chatModeUnlimited: true, slidesGeneration: false, imageGeneration: false,
        videoGeneration: false, betaFeatures: false, prioritySupport: false,
      }),
      is_popular: false,
      sort_order: 0,
    },
    {
      name: "Rubic Pro",
      type: "pro",
      description: "For professionals and power users. Dedicated resources and creative tools.",
      price_monthly: 3900,
      price_yearly: 38868,
      discount_yearly_percent: 17,
      monthly_credits: 3900,
      starter_credits: 1000,
      daily_refresh_credits: 300,
      max_concurrent_sessions: 3,
      max_parallel_subtasks: 10,
      max_scheduled_tasks: 3,
      max_steps_per_session: 30,
      features: JSON.stringify([
        "3,900 monthly credits", "300 daily refresh credits", "3 concurrent tasks",
        "10 parallel subtasks", "3 scheduled tasks", "Chat mode (unlimited)",
        "Full agent capabilities", "Image & slide generation", "Exclusive data sources",
        "Extended context length", "Priority access",
      ]),
      limits: JSON.stringify({
        maxSessions: 3, maxAgents: 5, maxStorage: 5000, maxTeamMembers: 0, maxProjects: 20,
        chatModeUnlimited: true, slidesGeneration: true, imageGeneration: true,
        videoGeneration: false, betaFeatures: false, prioritySupport: false,
      }),
      is_popular: true,
      sort_order: 1,
    },
    {
      name: "Rubic Max",
      type: "max",
      description: "Maximum power for demanding workflows. All features unlocked.",
      price_monthly: 19900,
      price_yearly: 198204,
      discount_yearly_percent: 17,
      monthly_credits: 19900,
      starter_credits: 1000,
      daily_refresh_credits: 300,
      max_concurrent_sessions: 10,
      max_parallel_subtasks: 20,
      max_scheduled_tasks: 10,
      max_steps_per_session: 50,
      features: JSON.stringify([
        "19,900 monthly credits", "300 daily refresh credits", "10 concurrent tasks",
        "20 parallel subtasks", "10 scheduled tasks", "Chat mode (unlimited)",
        "Full agent capabilities", "Image, slide & video generation", "All data sources",
        "Maximum context length", "Priority support", "Beta feature access",
      ]),
      limits: JSON.stringify({
        maxSessions: 10, maxAgents: 20, maxStorage: 50000, maxTeamMembers: 0, maxProjects: 100,
        chatModeUnlimited: true, slidesGeneration: true, imageGeneration: true,
        videoGeneration: true, betaFeatures: true, prioritySupport: true,
      }),
      is_popular: false,
      sort_order: 2,
    },
  ];

  for (const plan of plans) {
    const existing = await sql(`SELECT id FROM subscription_plans WHERE type = $1 LIMIT 1`, [plan.type]);

    if (existing.length > 0) {
      await sql(
        `UPDATE subscription_plans SET
          name = $1, description = $2, price_monthly = $3, price_yearly = $4,
          discount_yearly_percent = $5, monthly_credits = $6, starter_credits = $7,
          daily_refresh_credits = $8, max_concurrent_sessions = $9, max_parallel_subtasks = $10,
          max_scheduled_tasks = $11, max_steps_per_session = $12, features = $13,
          limits = $14, is_popular = $15, sort_order = $16, updated_at = now()
        WHERE type = $17`,
        [
          plan.name, plan.description, plan.price_monthly, plan.price_yearly,
          plan.discount_yearly_percent, plan.monthly_credits, plan.starter_credits,
          plan.daily_refresh_credits, plan.max_concurrent_sessions, plan.max_parallel_subtasks,
          plan.max_scheduled_tasks, plan.max_steps_per_session, plan.features,
          plan.limits, plan.is_popular, plan.sort_order, plan.type,
        ]
      );
      console.log(`   ~ ${plan.name} (updated)`);
    } else {
      const id = `plan_${plan.type}_${Date.now().toString(36)}`;
      await sql(
        `INSERT INTO subscription_plans (
          id, name, type, description, price_monthly, price_yearly,
          discount_yearly_percent, monthly_credits, starter_credits, daily_refresh_credits,
          max_concurrent_sessions, max_parallel_subtasks, max_scheduled_tasks,
          max_steps_per_session, features, limits, is_active, is_popular, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17, $18)`,
        [
          id, plan.name, plan.type, plan.description, plan.price_monthly, plan.price_yearly,
          plan.discount_yearly_percent, plan.monthly_credits, plan.starter_credits,
          plan.daily_refresh_credits, plan.max_concurrent_sessions, plan.max_parallel_subtasks,
          plan.max_scheduled_tasks, plan.max_steps_per_session, plan.features, plan.limits,
          plan.is_popular, plan.sort_order,
        ]
      );
      console.log(`   + ${plan.name} (created)`);
    }
  }

  // ── 5. Initialize credit balance for existing users ──────────────────────
  console.log("\n5. Initializing credit balances for existing users...");
  const usersWithoutBalance = await sql(`
    SELECT u.id FROM users u
    LEFT JOIN credit_balances cb ON cb.user_id = u.id
    WHERE cb.id IS NULL
  `);

  if (usersWithoutBalance.length === 0) {
    console.log("   ~ All users already have credit balances");
  } else {
    for (const user of usersWithoutBalance) {
      const id = `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await sql(
        `INSERT INTO credit_balances (
          id, user_id, balance, daily_credits, daily_credits_used, daily_refresh_amount,
          last_daily_refresh_at, starter_credits, starter_credits_used,
          period_credits, period_credits_used, purchased_credits, purchased_credits_used
        ) VALUES ($1, $2, 1300, 300, 0, 300, now(), 1000, 0, 0, 0, 0, 0)`,
        [id, user.id]
      );
      console.log(`   + Credit balance for user ${user.id.slice(0, 8)}... (1000 starter + 300 daily = 1300)`);
    }
  }

  // Update existing balances that have new columns at 0
  const updated = await sql(`
    UPDATE credit_balances SET
      starter_credits = 1000,
      daily_credits = 300,
      daily_refresh_amount = 300,
      last_daily_refresh_at = now(),
      balance = GREATEST(balance, 1300)
    WHERE starter_credits = 0 AND daily_credits = 0
    RETURNING user_id
  `);
  if (updated.length > 0) {
    console.log(`   ~ Updated ${updated.length} existing balance(s) with starter=1000, daily=300`);
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  console.log("\n=== Verification ===");
  const planCount = await sql(`SELECT type, name, monthly_credits, starter_credits, daily_refresh_credits, max_parallel_subtasks FROM subscription_plans ORDER BY sort_order`);
  console.log("\nPlans in DB:");
  for (const p of planCount) {
    console.log(`  ${p.name} (${p.type}): ${p.monthly_credits} monthly, ${p.starter_credits} starter, ${p.daily_refresh_credits} daily, ${p.max_parallel_subtasks} parallel`);
  }

  const balanceCount = await sql(`SELECT COUNT(*) as count FROM credit_balances`);
  console.log(`\nCredit balances: ${balanceCount[0]?.count ?? 0} rows`);

  const sampleBalance = await sql(`SELECT user_id, balance, daily_credits, starter_credits, daily_refresh_amount FROM credit_balances LIMIT 3`);
  for (const b of sampleBalance) {
    console.log(`  user ${b.user_id.slice(0, 8)}...: balance=${b.balance}, daily=${b.daily_credits}, starter=${b.starter_credits}`);
  }

  const ledgerExists = await sql(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_ledger') as exists`);
  console.log(`\nUsage ledger table: ${ledgerExists[0]?.exists ? "EXISTS" : "MISSING"}`);

  console.log("\n=== Done! ===");
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
