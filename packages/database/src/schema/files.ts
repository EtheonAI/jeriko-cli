import { pgTable, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { agentSessions } from "./sessions";

// Files - files created or uploaded during sessions
export const files = pgTable("files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionId: text("session_id").references(() => agentSessions.id, {
    onDelete: "set null",
  }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"), // in bytes
  storageKey: text("storage_key"), // S3/R2 key
  storageProvider: text("storage_provider", {
    enum: ["local", "s3", "r2", "vercel_blob"],
  }).default("local"),
  isPublic: boolean("is_public").default(false),
  metadata: jsonb("metadata").$type<{
    width?: number;
    height?: number;
    duration?: number;
    encoding?: string;
    [key: string]: unknown;
  }>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  session: one(agentSessions, {
    fields: [files.sessionId],
    references: [agentSessions.id],
  }),
  versions: many(fileVersions),
}));

// File versions for version control
export const fileVersions = pgTable("file_versions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  storageKey: text("storage_key").notNull(),
  size: integer("size"),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(files, {
    fields: [fileVersions.fileId],
    references: [files.id],
  }),
}));
