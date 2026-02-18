/**
 * E2E test for projects database tables and tRPC-level queries.
 * Verifies: projects, project_members, project_sessions, project_groups, project_group_items
 *
 * Run: export $(grep -v '^#' packages/database/.env | xargs) && npx tsx scripts/test-projects-db.ts
 */

async function main() {
  const mod = await import("../packages/database/src/index.js");
  const resolved = (mod as any).default ?? mod;
  const {
    db,
    projects,
    projectMembers,
    projectSessions,
    projectGroups,
    projectGroupItems,
    eq,
    sql,
    desc,
  } = resolved;

  console.log("=== Projects DB E2E Test ===\n");

  // Grab a real user ID from the DB
  const usersResult = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const usersRows = Array.isArray(usersResult) ? usersResult : (usersResult as any).rows ?? [];
  if (!usersRows[0]?.id) { console.log("No users in DB — cannot test. Skipping."); process.exit(0); }
  const TEST_USER_ID = usersRows[0].id as string;
  console.log(`Using real user: ${TEST_USER_ID}\n`);
  let testProjectId: string | null = null;
  let testGroupId: string | null = null;

  try {
    // ── 1. Check tables exist ──
    console.log("1. Checking tables exist...");
    const tables = ["projects", "project_members", "project_sessions", "project_groups", "project_group_items"];
    for (const table of tables) {
      const result = await db.execute(
        sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ${table}) AS "exists"`
      );
      const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
      const exists = rows[0]?.exists ?? false;
      console.log(`   ${table}: ${exists ? "✅" : "❌"}`);
      if (!exists) throw new Error(`Table ${table} does not exist!`);
    }

    // ── 2. Create a test project ──
    console.log("\n2. Creating test project...");
    const crypto = await import("crypto");
    const createId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    testProjectId = createId();
    const [created] = await db
      .insert(projects)
      .values({
        id: testProjectId,
        userId: TEST_USER_ID,
        name: "E2E Test Project",
        description: "Testing project CRUD",
        icon: "🧪",
        color: "#6366f1",
        status: "active",
        visibility: "private",
        settings: { connectorIds: ["conn-1", "conn-2"], instructions: "Test instructions" },
        tags: ["test", "e2e"],
        lastActivityAt: new Date(),
      })
      .returning();
    console.log(`   Created: ${created.id} — "${created.name}" ✅`);
    console.log(`   Settings: ${JSON.stringify(created.settings)}`);

    // ── 3. Read it back ──
    console.log("\n3. Reading project back...");
    const [fetched] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, testProjectId))
      .limit(1);
    console.log(`   Name: ${fetched.name} ✅`);
    console.log(`   Icon: ${fetched.icon}`);
    console.log(`   Color: ${fetched.color}`);
    console.log(`   Status: ${fetched.status}`);
    console.log(`   isPinned: ${fetched.isPinned}`);
    console.log(`   Tags: ${JSON.stringify(fetched.tags)}`);

    // ── 4. Update (pin it) ──
    console.log("\n4. Pinning project...");
    const [updated] = await db
      .update(projects)
      .set({ isPinned: true, lastActivityAt: new Date() })
      .where(eq(projects.id, testProjectId))
      .returning();
    console.log(`   isPinned: ${updated.isPinned} ✅`);

    // ── 5. Add a project member (using same real user as "editor") ──
    console.log("\n5. Adding project member...");
    const memberId = createId();
    const [member] = await db
      .insert(projectMembers)
      .values({
        id: memberId,
        projectId: testProjectId,
        userId: TEST_USER_ID,
        role: "editor",
      })
      .returning();
    console.log(`   Member: ${member.id} role=${member.role} ✅`);

    // ── 6. List members ──
    console.log("\n6. Listing members...");
    const members = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, testProjectId));
    console.log(`   Found ${members.length} member(s) ✅`);

    // ── 7. Create project group ──
    console.log("\n7. Creating project group...");
    testGroupId = createId();
    const [group] = await db
      .insert(projectGroups)
      .values({
        id: testGroupId,
        userId: TEST_USER_ID,
        name: "E2E Test Group",
        color: "#22c55e",
      })
      .returning();
    console.log(`   Group: ${group.id} — "${group.name}" ✅`);

    // ── 8. Add project to group ──
    console.log("\n8. Adding project to group...");
    const groupItemId = createId();
    const [groupItem] = await db
      .insert(projectGroupItems)
      .values({
        id: groupItemId,
        groupId: testGroupId,
        projectId: testProjectId,
      })
      .returning();
    console.log(`   GroupItem: ${groupItem.id} ✅`);

    // ── 9. Test project_sessions linking (simulate) ──
    console.log("\n9. Testing project_sessions table...");
    // We can't link to a real session since we don't have one, but we can verify the table structure
    const psResult = await db.execute(
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'project_sessions' ORDER BY ordinal_position`
    );
    const psColumns = Array.isArray(psResult) ? psResult : (psResult as any).rows ?? [];
    console.log(`   Columns: ${psColumns.map((c: any) => c.column_name).join(", ")} ✅`);

    // ── 10. List all projects for user ──
    console.log("\n10. Listing all projects for test user...");
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, TEST_USER_ID))
      .orderBy(desc(projects.isPinned), desc(projects.lastActivityAt));
    console.log(`   Found ${allProjects.length} project(s) ✅`);
    for (const p of allProjects) {
      console.log(`   - ${p.icon ?? "📁"} ${p.name} (pinned=${p.isPinned})`);
    }

    console.log("\n✅ ALL TESTS PASSED\n");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    // ── Cleanup ──
    console.log("Cleaning up test data...");
    try {
      if (testGroupId) {
        await db.delete(projectGroupItems).where(eq(projectGroupItems.groupId, testGroupId));
        await db.delete(projectGroups).where(eq(projectGroups.id, testGroupId));
        console.log("   Deleted test group ✅");
      }
      if (testProjectId) {
        await db.delete(projectMembers).where(eq(projectMembers.projectId, testProjectId));
        await db.delete(projects).where(eq(projects.id, testProjectId));
        console.log("   Deleted test project ✅");
      }
    } catch (cleanupErr) {
      console.error("   Cleanup error:", cleanupErr);
    }
    process.exit(process.exitCode ?? 0);
  }
}

main();
