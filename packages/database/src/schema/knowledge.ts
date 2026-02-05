import { pgTable, text, timestamp, boolean, jsonb, integer, real } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";
import { agentSessions } from "./sessions";
import { vector } from "./vector";

/**
 * Knowledge Schema
 * Knowledge base, documents, and attachments
 */

export type KnowledgeItemType = "document" | "webpage" | "file" | "note" | "bookmark";
export type KnowledgeStatus = "processing" | "ready" | "failed" | "archived";

// Knowledge Groups (folders/collections)
export const knowledgeGroups = pgTable("knowledge_groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  parentId: text("parent_id"), // For nested groups
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  // Ordering
  sortOrder: integer("sort_order").default(0),
  isExpanded: boolean("is_expanded").default(true).notNull(),
  // Sharing
  isShared: boolean("is_shared").default(false).notNull(),
  shareSettings: jsonb("share_settings").$type<{
    visibility?: "private" | "team" | "public";
    allowedUserIds?: string[];
    allowedRoles?: string[];
  }>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const knowledgeGroupsRelations = relations(knowledgeGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeGroups.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [knowledgeGroups.organizationId],
    references: [organizations.id],
  }),
  parent: one(knowledgeGroups, {
    fields: [knowledgeGroups.parentId],
    references: [knowledgeGroups.id],
  }),
  items: many(knowledgeItems),
}));

// Knowledge Items (documents, files, webpages, etc.)
export const knowledgeItems = pgTable("knowledge_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  groupId: text("group_id").references(() => knowledgeGroups.id, {
    onDelete: "set null",
  }),
  // Item details
  type: text("type", {
    enum: ["document", "webpage", "file", "note", "bookmark"],
  }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // Content
  content: text("content"), // Full text content for search
  contentPreview: text("content_preview"), // Truncated preview
  // Source information
  sourceUrl: text("source_url"),
  sourceType: text("source_type"), // e.g., "google_drive", "notion", "upload"
  sourceId: text("source_id"), // ID in source system
  // File information (if applicable)
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  storageKey: text("storage_key"),
  thumbnailUrl: text("thumbnail_url"),
  // Processing status
  status: text("status", {
    enum: ["processing", "ready", "failed", "archived"],
  })
    .default("processing")
    .notNull(),
  processingError: text("processing_error"),
  // Embeddings for vector search
  embeddingId: text("embedding_id"), // Reference to vector store
  embeddingModel: text("embedding_model"),
  // Metadata
  tags: jsonb("tags").$type<string[]>(),
  metadata: jsonb("metadata").$type<{
    author?: string;
    pageCount?: number;
    wordCount?: number;
    language?: string;
    extractedAt?: string;
    [key: string]: unknown;
  }>(),
  // Timestamps
  lastAccessedAt: timestamp("last_accessed_at", { mode: "date" }),
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const knowledgeItemsRelations = relations(knowledgeItems, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeItems.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [knowledgeItems.organizationId],
    references: [organizations.id],
  }),
  group: one(knowledgeGroups, {
    fields: [knowledgeItems.groupId],
    references: [knowledgeGroups.id],
  }),
  chunks: many(knowledgeChunks),
}));

// Knowledge Chunks (for RAG)
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  itemId: text("item_id")
    .notNull()
    .references(() => knowledgeItems.id, { onDelete: "cascade" }),
  // Chunk content
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  // Position in document
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  pageNumber: integer("page_number"),
  // Embedding
  embeddingId: text("embedding_id"),
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: text("embedding_model"),
  // Metadata
  metadata: jsonb("metadata").$type<{
    heading?: string;
    section?: string;
    [key: string]: unknown;
  }>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  item: one(knowledgeItems, {
    fields: [knowledgeChunks.itemId],
    references: [knowledgeItems.id],
  }),
}));

// Session Attachments (files attached to chat sessions)
export const sessionAttachments = pgTable("session_attachments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionId: text("session_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Can link to existing knowledge item
  knowledgeItemId: text("knowledge_item_id").references(() => knowledgeItems.id, {
    onDelete: "set null",
  }),
  // Or be a standalone attachment
  name: text("name").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  storageKey: text("storage_key"),
  thumbnailUrl: text("thumbnail_url"),
  // Processing
  status: text("status", {
    enum: ["uploading", "processing", "ready", "failed"],
  })
    .default("uploading")
    .notNull(),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const sessionAttachmentsRelations = relations(sessionAttachments, ({ one }) => ({
  session: one(agentSessions, {
    fields: [sessionAttachments.sessionId],
    references: [agentSessions.id],
  }),
  user: one(users, {
    fields: [sessionAttachments.userId],
    references: [users.id],
  }),
  knowledgeItem: one(knowledgeItems, {
    fields: [sessionAttachments.knowledgeItemId],
    references: [knowledgeItems.id],
  }),
}));

// Export types
export type KnowledgeGroup = typeof knowledgeGroups.$inferSelect;
export type NewKnowledgeGroup = typeof knowledgeGroups.$inferInsert;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItem = typeof knowledgeItems.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
export type SessionAttachment = typeof sessionAttachments.$inferSelect;
export type NewSessionAttachment = typeof sessionAttachments.$inferInsert;
