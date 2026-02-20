import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// Framework enum values
export const builderFrameworks = ["nextjs", "react", "vue", "svelte", "astro"] as const;
export type BuilderFramework = (typeof builderFrameworks)[number];

// Project status enum values
export const projectStatuses = ["idle", "building", "deployed", "failed"] as const;
export type BuilderProjectStatus = (typeof projectStatuses)[number];

// Deployment platform enum values
export const deploymentPlatforms = ["vercel", "netlify", "s3"] as const;
export type DeploymentPlatform = (typeof deploymentPlatforms)[number];

// Deployment status enum values
export const deploymentStatuses = [
  "queued",
  "building",
  "deploying",
  "deployed",
  "failed",
] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

// Website projects table - Builder project records
export const websiteProjects = pgTable("website_projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id"),

  // Project info
  name: text("name").notNull(),
  description: text("description"),
  framework: text("framework").$type<BuilderFramework>().notNull().default("nextjs"),
  status: text("status").$type<BuilderProjectStatus>().notNull().default("idle"),

  // URLs
  previewUrl: text("preview_url"),
  productionUrl: text("production_url"),
  customDomain: text("custom_domain"),

  // Configuration
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const websiteProjectsRelations = relations(websiteProjects, ({ one, many }) => ({
  user: one(users, {
    fields: [websiteProjects.userId],
    references: [users.id],
  }),
  files: many(projectFiles),
  deployments: many(deployments),
}));

// Project files table - Generated code files
export const projectFiles = pgTable("project_files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id").notNull(),

  // File info
  path: text("path").notNull(),
  name: text("name").notNull(),
  content: text("content"),
  language: text("language"),

  // Versioning
  version: integer("version").notNull().default(1),
  isDirectory: boolean("is_directory").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(websiteProjects, {
    fields: [projectFiles.projectId],
    references: [websiteProjects.id],
  }),
}));

// Deployments table - Deployment history
export const deployments = pgTable("deployments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id").notNull(),
  userId: text("user_id"),
  sessionId: text("session_id"),

  // Deployment info
  platform: text("platform").$type<DeploymentPlatform>().notNull().default("vercel"),
  status: text("status").$type<DeploymentStatus>().notNull().default("queued"),
  url: text("url"),
  s3Prefix: text("s3_prefix"),
  buildLog: text("build_log"),
  environment: text("environment").default("preview"),
  commitHash: text("commit_hash"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(websiteProjects, {
    fields: [deployments.projectId],
    references: [websiteProjects.id],
  }),
}));

// Type exports
export type WebsiteProject = typeof websiteProjects.$inferSelect;
export type NewWebsiteProject = typeof websiteProjects.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
