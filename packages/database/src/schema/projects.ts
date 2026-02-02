import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";
import { agentSessions } from "./sessions";

/**
 * Projects Schema
 * Project management with sessions and collaboration
 */

export type ProjectStatus = "active" | "archived" | "completed" | "paused";
export type ProjectVisibility = "private" | "team" | "public";
export type ProjectMemberRole = "owner" | "admin" | "editor" | "viewer";

// Projects
export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  // Project details
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  // Status and visibility
  status: text("status", {
    enum: ["active", "archived", "completed", "paused"],
  })
    .default("active")
    .notNull(),
  visibility: text("visibility", {
    enum: ["private", "team", "public"],
  })
    .default("private")
    .notNull(),
  // Pinning and ordering
  isPinned: boolean("is_pinned").default(false).notNull(),
  sortOrder: integer("sort_order").default(0),
  // Settings
  settings: jsonb("settings").$type<{
    defaultAgentId?: string;
    autoArchiveDays?: number;
    notificationsEnabled?: boolean;
    [key: string]: unknown;
  }>(),
  // Tags
  tags: jsonb("tags").$type<string[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  // Timestamps
  lastActivityAt: timestamp("last_activity_at", { mode: "date" }),
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  members: many(projectMembers),
  sessions: many(projectSessions),
}));

// Project Members
export const projectMembers = pgTable("project_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["owner", "admin", "editor", "viewer"],
  })
    .default("viewer")
    .notNull(),
  // Permissions override
  permissions: jsonb("permissions").$type<{
    canEdit?: boolean;
    canDelete?: boolean;
    canInvite?: boolean;
    canManageSettings?: boolean;
  }>(),
  // Notifications
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
});

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

// Project Sessions (linking sessions to projects)
export const projectSessions = pgTable("project_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  // Ordering within project
  sortOrder: integer("sort_order").default(0),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const projectSessionsRelations = relations(
  projectSessions,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectSessions.projectId],
      references: [projects.id],
    }),
    session: one(agentSessions, {
      fields: [projectSessions.sessionId],
      references: [agentSessions.id],
    }),
  })
);

// Project Groups (for organizing projects)
export const projectGroups = pgTable("project_groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
  isExpanded: boolean("is_expanded").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectGroupsRelations = relations(
  projectGroups,
  ({ one, many }) => ({
    user: one(users, {
      fields: [projectGroups.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [projectGroups.organizationId],
      references: [organizations.id],
    }),
    projectGroupItems: many(projectGroupItems),
  })
);

// Project Group Items (projects in groups)
export const projectGroupItems = pgTable("project_group_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  groupId: text("group_id")
    .notNull()
    .references(() => projectGroups.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const projectGroupItemsRelations = relations(
  projectGroupItems,
  ({ one }) => ({
    group: one(projectGroups, {
      fields: [projectGroupItems.groupId],
      references: [projectGroups.id],
    }),
    project: one(projects, {
      fields: [projectGroupItems.projectId],
      references: [projects.id],
    }),
  })
);

// Export types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectSession = typeof projectSessions.$inferSelect;
export type NewProjectSession = typeof projectSessions.$inferInsert;
export type ProjectGroup = typeof projectGroups.$inferSelect;
export type NewProjectGroup = typeof projectGroups.$inferInsert;
export type ProjectGroupItem = typeof projectGroupItems.$inferSelect;
export type NewProjectGroupItem = typeof projectGroupItems.$inferInsert;
