import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, skillDefinitions, users, eq, sql } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

// Seed data — exact same 11 skills from the hardcoded list
const DEFAULT_SKILLS: Array<{
  type: string;
  name: string;
  description: string;
  category: "research" | "development" | "productivity" | "creative" | "analysis";
  icon: string;
  isPremium: boolean;
  defaultEnabled: boolean;
}> = [
  {
    type: "web_browsing",
    name: "Web Browsing",
    description: "Search the web and extract information from websites",
    icon: "globe",
    category: "research",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "code_execution",
    name: "Code Execution",
    description: "Write and execute code in multiple languages",
    icon: "code",
    category: "development",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "file_operations",
    name: "File Operations",
    description: "Read, write, and manage files on your devices",
    icon: "file-text",
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "image_generation",
    name: "Image Generation",
    description: "Generate images using AI models",
    icon: "image",
    category: "creative",
    defaultEnabled: false,
    isPremium: true,
  },
  {
    type: "deep_research",
    name: "Deep Research",
    description: "Comprehensive research with multiple sources",
    icon: "search",
    category: "research",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "terminal_access",
    name: "Terminal Access",
    description: "Execute shell commands on connected devices",
    icon: "terminal",
    category: "development",
    defaultEnabled: false,
    isPremium: false,
  },
  {
    type: "database_queries",
    name: "Database Queries",
    description: "Query and manage connected databases",
    icon: "database",
    category: "development",
    defaultEnabled: false,
    isPremium: true,
  },
  {
    type: "advanced_reasoning",
    name: "Advanced Reasoning",
    description: "Complex multi-step reasoning and analysis",
    icon: "brain",
    category: "analysis",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "conversation_memory",
    name: "Conversation Memory",
    description: "Remember context from previous conversations",
    icon: "message-square",
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "data_analysis",
    name: "Data Analysis",
    description: "Analyze data and create visualizations",
    icon: "bar-chart",
    category: "analysis",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    type: "scheduling",
    name: "Task Scheduling",
    description: "Schedule tasks to run automatically",
    icon: "calendar",
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
];

let seeded = false;

async function ensureSkillsSeeded() {
  if (seeded) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(skillDefinitions);
  if (row && row.count > 0) {
    seeded = true;
    return;
  }
  await db
    .insert(skillDefinitions)
    .values(
      DEFAULT_SKILLS.map((s) => ({
        id: createId(),
        type: s.type,
        name: s.name,
        description: s.description,
        category: s.category,
        icon: s.icon,
        isPremium: s.isPremium,
        defaultEnabled: s.defaultEnabled,
        isEnabled: true,
      }))
    )
    .onConflictDoNothing();
  seeded = true;
}

export const skillsRouter = createTRPCRouter({
  // List all enabled skill definitions
  list: protectedProcedure.query(async () => {
    await ensureSkillsSeeded();

    const definitions = await db
      .select()
      .from(skillDefinitions)
      .where(eq(skillDefinitions.isEnabled, true))
      .orderBy(skillDefinitions.category, skillDefinitions.name);

    return definitions;
  }),

  // Toggle a skill for the current user (updates preferences JSONB)
  toggle: protectedProcedure
    .input(
      z.object({
        skillType: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Read current preferences
      const [user] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const currentPrefs = (user?.preferences ?? {}) as Record<string, unknown>;
      const enabledSkills = (currentPrefs.enabledSkills ?? {}) as Record<string, boolean>;

      // Update the skill state
      enabledSkills[input.skillType] = input.enabled;

      // Write back
      await db
        .update(users)
        .set({
          preferences: { ...currentPrefs, enabledSkills },
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true, enabledSkills };
    }),
});
