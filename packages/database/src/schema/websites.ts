import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// Website status enum values
export const websiteStatuses = ["pending", "crawling", "completed", "failed", "paused"] as const;
export type WebsiteStatus = (typeof websiteStatuses)[number];

// Websites table - websites being scraped/monitored
export const websites = pgTable("websites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id"),
  projectId: text("project_id"),

  // Website info
  name: text("name").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),

  // Crawl status
  status: text("status").$type<WebsiteStatus>().notNull().default("pending"),

  // Crawl configuration
  config: jsonb("config").$type<{
    maxDepth?: number;
    maxPages?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
    respectRobotsTxt?: boolean;
    crawlDelay?: number;
    userAgent?: string;
    javascript?: boolean;
  }>().default({}),

  // Crawl stats
  pagesDiscovered: integer("pages_discovered").notNull().default(0),
  pagesCrawled: integer("pages_crawled").notNull().default(0),
  pagesErrored: integer("pages_errored").notNull().default(0),

  // Timing
  lastCrawlAt: timestamp("last_crawl_at"),
  nextCrawlAt: timestamp("next_crawl_at"),
  crawlFrequency: text("crawl_frequency").$type<"once" | "daily" | "weekly" | "monthly">().default("once"),

  // Metadata
  favicon: text("favicon"),
  title: text("title"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const websitesRelations = relations(websites, ({ one, many }) => ({
  user: one(users, {
    fields: [websites.userId],
    references: [users.id],
  }),
  pages: many(websitePages),
  crawlJobs: many(websiteCrawlJobs),
}));

// Website pages - individual pages crawled
export const websitePages = pgTable("website_pages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  websiteId: text("website_id").notNull(),

  // Page info
  url: text("url").notNull(),
  path: text("path").notNull(),
  title: text("title"),

  // Content
  rawHtml: text("raw_html"),
  textContent: text("text_content"),
  markdown: text("markdown"),

  // Extracted data
  links: jsonb("links").$type<string[]>().default([]),
  images: jsonb("images").$type<Array<{ src: string; alt?: string }>>().default([]),
  headings: jsonb("headings").$type<Array<{ level: number; text: string }>>().default([]),

  // Page metadata
  statusCode: integer("status_code"),
  contentType: text("content_type"),
  contentLength: integer("content_length"),

  // SEO metadata
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  canonical: text("canonical"),

  // Depth from root
  depth: integer("depth").notNull().default(0),

  // Crawl info
  crawledAt: timestamp("crawled_at"),
  error: text("error"),

  // Change detection
  contentHash: text("content_hash"),
  lastChangedAt: timestamp("last_changed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const websitePagesRelations = relations(websitePages, ({ one }) => ({
  website: one(websites, {
    fields: [websitePages.websiteId],
    references: [websites.id],
  }),
}));

// Website crawl jobs - crawl job executions
export const websiteCrawlJobs = pgTable("website_crawl_jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  websiteId: text("website_id").notNull(),

  // Job status
  status: text("status").$type<"queued" | "running" | "completed" | "failed" | "cancelled">().notNull().default("queued"),

  // Progress
  pagesQueued: integer("pages_queued").notNull().default(0),
  pagesProcessed: integer("pages_processed").notNull().default(0),
  pagesSucceeded: integer("pages_succeeded").notNull().default(0),
  pagesFailed: integer("pages_failed").notNull().default(0),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Error handling
  error: text("error"),
  errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),

  // Configuration used
  config: jsonb("config").$type<Record<string, unknown>>(),

  // Resource usage
  bytesDownloaded: integer("bytes_downloaded").notNull().default(0),
  requestCount: integer("request_count").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const websiteCrawlJobsRelations = relations(websiteCrawlJobs, ({ one }) => ({
  website: one(websites, {
    fields: [websiteCrawlJobs.websiteId],
    references: [websites.id],
  }),
}));

// Type exports
export type Website = typeof websites.$inferSelect;
export type NewWebsite = typeof websites.$inferInsert;
export type WebsitePage = typeof websitePages.$inferSelect;
export type NewWebsitePage = typeof websitePages.$inferInsert;
export type WebsiteCrawlJob = typeof websiteCrawlJobs.$inferSelect;
export type NewWebsiteCrawlJob = typeof websiteCrawlJobs.$inferInsert;
