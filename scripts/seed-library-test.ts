/**
 * Seed script for Library page testing.
 *
 * Inserts test agent_sessions and files into the database so the Library
 * page can be exercised end-to-end.
 *
 * Usage:
 *   npx tsx scripts/seed-library-test.ts
 *
 * Prerequisites:
 *   - DATABASE_URL in packages/database/.env (auto-loaded below)
 *   - Run from the repo root so node_modules resolve correctly
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, timestamp, integer, jsonb, boolean as pgBoolean } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// 1. Load DATABASE_URL from packages/database/.env
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../packages/database/.env");

if (!process.env.DATABASE_URL) {
  try {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^DATABASE_URL\s*=\s*(.+)/);
      if (match?.[1]) {
        process.env.DATABASE_URL = match[1].trim();
        break;
      }
    }
  } catch {
    console.error("Could not read .env — set DATABASE_URL manually");
    process.exit(1);
  }
}

console.log("Connecting to database...");

// ---------------------------------------------------------------------------
// 2. Inline table definitions (avoids ESM / workspace import headaches)
// ---------------------------------------------------------------------------
const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

const agentSessions = pgTable("agent_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"),
  status: text("status").default("active"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

const files = pgTable("files", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  storageKey: text("storage_key"),
  storageProvider: text("storage_provider").default("local"),
  isPublic: pgBoolean("is_public").default(false),
  checksum: text("checksum"),
  checksumAlgorithm: text("checksum_algorithm").default("sha256"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 3. Connect
// ---------------------------------------------------------------------------
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Simple ID generator (cuid2 isn't hoisted to root)
function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

// ---------------------------------------------------------------------------
// 4. Seed logic
// ---------------------------------------------------------------------------
async function main() {
  // --- Get the first user -----------------------------------------------
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    console.error("No users found in the database. Sign up first, then re-run.");
    process.exit(1);
  }
  const user = existingUsers[0]!;
  console.log(`Using user: ${user.name ?? user.email} (${user.id})`);

  // --- Create 3 test agent_sessions -------------------------------------
  const sessionData = [
    {
      id: newId(),
      userId: user.id,
      title: "Research: Renewable Energy Trends 2026",
      status: "completed" as const,
      metadata: { topic: "energy" },
    },
    {
      id: newId(),
      userId: user.id,
      title: "Build Landing Page for SaaS Product",
      status: "completed" as const,
      metadata: { topic: "webdev" },
    },
    {
      id: newId(),
      userId: user.id,
      title: "Data Analysis: Q4 Sales Report",
      status: "active" as const,
      metadata: { topic: "analytics" },
    },
  ];

  const insertedSessions = await db.insert(agentSessions).values(sessionData).returning();
  console.log(`\nInserted ${insertedSessions.length} agent_sessions:`);
  for (const s of insertedSessions) {
    console.log(`  - [${s.id}] ${s.title} (${s.status})`);
  }

  // --- Create 7 test files spread across sessions -----------------------
  const [session1, session2, session3] = insertedSessions;

  const fileData = [
    // Session 1 — Research files
    {
      id: newId(),
      sessionId: session1!.id,
      userId: user.id,
      name: "renewable-energy-report.md",
      path: "/files/renewable-energy-report.md",
      mimeType: "text/markdown",
      size: 14200,
      storageKey: "https://raw.githubusercontent.com/github/gitignore/main/README.md",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { toolCallId: "tool_research_001" },
    },
    {
      id: newId(),
      sessionId: session1!.id,
      userId: user.id,
      name: "energy-statistics-2026.pdf",
      path: "/files/energy-statistics-2026.pdf",
      mimeType: "application/pdf",
      size: 2_450_000,
      storageKey: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { toolCallId: "tool_research_002" },
    },

    // Session 2 — Web dev files
    {
      id: newId(),
      sessionId: session2!.id,
      userId: user.id,
      name: "landing-page.html",
      path: "/files/landing-page.html",
      mimeType: "text/html",
      size: 8700,
      storageKey: "https://raw.githubusercontent.com/h5bp/html5-boilerplate/main/src/index.html",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { toolCallId: "tool_webdev_001" },
    },
    {
      id: newId(),
      sessionId: session2!.id,
      userId: user.id,
      name: "hero-banner.png",
      path: "/files/hero-banner.png",
      mimeType: "image/png",
      size: 340_000,
      storageKey: "https://via.placeholder.com/1200x600.png?text=Hero+Banner",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { width: 1200, height: 600, toolCallId: "tool_webdev_002" },
    },
    {
      id: newId(),
      sessionId: session2!.id,
      userId: user.id,
      name: "site-config.json",
      path: "/files/site-config.json",
      mimeType: "application/json",
      size: 1250,
      storageKey: "https://raw.githubusercontent.com/vercel/next.js/canary/package.json",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { toolCallId: "tool_webdev_003" },
    },

    // Session 3 — Analytics files
    {
      id: newId(),
      sessionId: session3!.id,
      userId: user.id,
      name: "q4-sales-summary.md",
      path: "/files/q4-sales-summary.md",
      mimeType: "text/markdown",
      size: 6800,
      storageKey: "https://raw.githubusercontent.com/sindresorhus/awesome/main/readme.md",
      storageProvider: "s3" as const,
      isPublic: true,
      metadata: { toolCallId: "tool_analytics_001" },
    },

    // Standalone file (no session)
    {
      id: newId(),
      sessionId: null,
      userId: user.id,
      name: "profile-photo.png",
      path: "/files/profile-photo.png",
      mimeType: "image/png",
      size: 185_000,
      storageKey: "https://via.placeholder.com/400x400.png?text=Profile",
      storageProvider: "s3" as const,
      isPublic: false,
      metadata: { width: 400, height: 400 },
    },
  ];

  const insertedFiles = await db.insert(files).values(fileData).returning();
  console.log(`\nInserted ${insertedFiles.length} files:`);
  for (const f of insertedFiles) {
    const sessionLabel = f.sessionId
      ? insertedSessions.find((s) => s.id === f.sessionId)?.title ?? f.sessionId
      : "(no session)";
    console.log(`  - [${f.id}] ${f.name}  (${f.mimeType}, ${f.size} bytes)  session: ${sessionLabel}`);
  }

  console.log("\nDone! Library page should now show these files.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
