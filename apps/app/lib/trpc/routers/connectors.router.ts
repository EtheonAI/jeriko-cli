import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  connectorDefinitions,
  userConnectors,
  connectorSyncLogs,
  eq,
  and,
  desc,
  sql,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

// Composio-aligned app catalog — seeded on first query if table is empty
const DEFAULT_DEFINITIONS: Array<{
  type: string;
  name: string;
  description: string;
  category:
    | "communication"
    | "storage"
    | "productivity"
    | "development"
    | "crm"
    | "analytics"
    | "other";
  authType: "oauth2" | "api_key" | "basic" | "custom";
  icon: string | null;
}> = [
  // Communication
  {
    type: "gmail",
    name: "Gmail",
    description: "Send, read, and manage emails from your Gmail account",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/gmail",
  },
  {
    type: "slack",
    name: "Slack",
    description: "Send messages, manage channels, and automate workflows in Slack",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/slack",
  },
  {
    type: "discord",
    name: "Discord",
    description: "Send messages and manage servers on Discord",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/discord",
  },
  {
    type: "teams",
    name: "Microsoft Teams",
    description: "Chat, meet, and collaborate with Microsoft Teams",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftteams",
  },
  {
    type: "outlook",
    name: "Outlook",
    description: "Manage emails and calendar events in Microsoft Outlook",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftoutlook",
  },
  {
    type: "twilio",
    name: "Twilio",
    description: "Send SMS, make calls, and manage communications via Twilio",
    category: "communication",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/twilio",
  },
  {
    type: "mailchimp",
    name: "Mailchimp",
    description: "Create and manage email campaigns and audiences",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/mailchimp",
  },
  {
    type: "sendgrid",
    name: "SendGrid",
    description: "Send transactional and marketing emails at scale",
    category: "communication",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/sendgrid",
  },
  {
    type: "telegram",
    name: "Telegram",
    description: "Send messages and manage bots on Telegram",
    category: "communication",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/telegram",
  },

  // Storage
  {
    type: "google_drive",
    name: "Google Drive",
    description: "Store, share, and collaborate on files in Google Drive",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googledrive",
  },
  {
    type: "dropbox",
    name: "Dropbox",
    description: "Sync and share files securely with Dropbox",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/dropbox",
  },
  {
    type: "onedrive",
    name: "OneDrive",
    description: "Store and share files with Microsoft OneDrive",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftonedrive",
  },
  {
    type: "box",
    name: "Box",
    description: "Secure cloud content management and file sharing",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/box",
  },
  {
    type: "sharepoint",
    name: "SharePoint",
    description: "Collaborate on documents and sites with SharePoint",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftsharepoint",
  },

  // Productivity
  {
    type: "notion",
    name: "Notion",
    description: "Create and manage docs, databases, and wikis in Notion",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/notion",
  },
  {
    type: "google_calendar",
    name: "Google Calendar",
    description: "Create and manage events, check availability on Google Calendar",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googlecalendar",
  },
  {
    type: "asana",
    name: "Asana",
    description: "Track tasks, projects, and team work in Asana",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/asana",
  },
  {
    type: "trello",
    name: "Trello",
    description: "Organize projects and tasks with Trello boards and cards",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/trello",
  },
  {
    type: "todoist",
    name: "Todoist",
    description: "Manage personal and team tasks with Todoist",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/todoist",
  },
  {
    type: "clickup",
    name: "ClickUp",
    description: "All-in-one project management and productivity platform",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/clickup",
  },
  {
    type: "confluence",
    name: "Confluence",
    description: "Create and collaborate on team documentation in Confluence",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/confluence",
  },
  {
    type: "airtable",
    name: "Airtable",
    description: "Build flexible databases and apps with Airtable",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/airtable",
  },
  {
    type: "google_sheets",
    name: "Google Sheets",
    description: "Create and edit spreadsheets in Google Sheets",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googlesheets",
  },
  {
    type: "google_docs",
    name: "Google Docs",
    description: "Create and collaborate on documents in Google Docs",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googledocs",
  },
  {
    type: "zoom",
    name: "Zoom",
    description: "Schedule and manage video meetings with Zoom",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/zoom",
  },

  // Development
  {
    type: "github",
    name: "GitHub",
    description: "Manage repos, issues, PRs, and actions on GitHub",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/github",
  },
  {
    type: "gitlab",
    name: "GitLab",
    description: "Manage repos, pipelines, and merge requests on GitLab",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/gitlab",
  },
  {
    type: "bitbucket",
    name: "Bitbucket",
    description: "Manage repos, pull requests, and pipelines on Bitbucket",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/bitbucket",
  },
  {
    type: "jira",
    name: "Jira",
    description: "Track issues, sprints, and project progress in Jira",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/jira",
  },
  {
    type: "linear",
    name: "Linear",
    description: "Plan and track software projects with Linear",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/linear",
  },
  {
    type: "figma",
    name: "Figma",
    description: "Access designs, components, and comments in Figma",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/figma",
  },
  {
    type: "vercel",
    name: "Vercel",
    description: "Manage deployments and projects on Vercel",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/vercel",
  },
  {
    type: "sentry",
    name: "Sentry",
    description: "Monitor errors and performance issues with Sentry",
    category: "development",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/sentry",
  },

  // CRM
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Manage contacts, leads, and deals in Salesforce",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/salesforce",
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Manage contacts, deals, and marketing in HubSpot",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/hubspot",
  },
  {
    type: "pipedrive",
    name: "Pipedrive",
    description: "Manage sales pipeline and deals with Pipedrive",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/pipedrive",
  },
  {
    type: "zendesk",
    name: "Zendesk",
    description: "Manage support tickets and customer interactions",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/zendesk",
  },
  {
    type: "intercom",
    name: "Intercom",
    description: "Manage customer conversations and support with Intercom",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/intercom",
  },
  {
    type: "freshdesk",
    name: "Freshdesk",
    description: "Customer support ticketing and helpdesk",
    category: "crm",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/freshdesk",
  },

  // Analytics
  {
    type: "google_analytics",
    name: "Google Analytics",
    description: "Track website traffic and user behavior",
    category: "analytics",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googleanalytics",
  },
  {
    type: "mixpanel",
    name: "Mixpanel",
    description: "Product analytics for user behavior tracking",
    category: "analytics",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/mixpanel",
  },
  {
    type: "amplitude",
    name: "Amplitude",
    description: "Digital analytics for product and growth teams",
    category: "analytics",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/amplitude",
  },

  // Other
  {
    type: "stripe_connector",
    name: "Stripe",
    description: "Manage payments, subscriptions, and customers with Stripe",
    category: "other",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/stripe",
  },
  {
    type: "shopify",
    name: "Shopify",
    description: "Manage products, orders, and customers on Shopify",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/shopify",
  },
  {
    type: "zapier",
    name: "Zapier",
    description: "Connect and automate workflows across 5,000+ apps",
    category: "other",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/zapier",
  },
  {
    type: "make_connector",
    name: "Make",
    description: "Visual automation platform for complex workflows",
    category: "other",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/make",
  },
  {
    type: "custom_webhook",
    name: "Webhooks",
    description: "Send and receive custom webhook events",
    category: "other",
    authType: "custom",
    icon: null,
  },
  {
    type: "twitter",
    name: "X (Twitter)",
    description: "Post tweets, read timelines, and manage your X account",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/x",
  },
  {
    type: "reddit",
    name: "Reddit",
    description: "Browse, post, and interact on Reddit",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/reddit",
  },
  {
    type: "spotify",
    name: "Spotify",
    description: "Control playback, manage playlists, and browse music",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/spotify",
  },
  {
    type: "youtube",
    name: "YouTube",
    description: "Manage videos, playlists, and channels on YouTube",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/youtube",
  },
];

let seeded = false;

async function ensureDefinitionsSeeded() {
  if (seeded) return;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(connectorDefinitions);
  if (row && row.count > 0) {
    seeded = true;
    return;
  }
  // Table is empty — seed it
  await db
    .insert(connectorDefinitions)
    .values(
      DEFAULT_DEFINITIONS.map((d) => ({
        id: createId(),
        type: d.type,
        name: d.name,
        description: d.description,
        category: d.category,
        authType: d.authType,
        icon: d.icon,
        isEnabled: true,
        isPremium: false,
      }))
    )
    .onConflictDoNothing();
  seeded = true;
}

export const connectorsRouter = createTRPCRouter({
  // List all available connector definitions
  listDefinitions: protectedProcedure.query(async () => {
    await ensureDefinitionsSeeded();

    const definitions = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.isEnabled, true))
      .orderBy(connectorDefinitions.category, connectorDefinitions.name);

    return definitions;
  }),

  // List user's installed connectors
  list: protectedProcedure.query(async ({ ctx }) => {
    const connectors = await db
      .select({
        connector: userConnectors,
        definition: connectorDefinitions,
      })
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(eq(userConnectors.userId, ctx.user.id))
      .orderBy(desc(userConnectors.createdAt));

    return connectors;
  }),

  // Get a single connector by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [connector] = await db
      .select({
        connector: userConnectors,
        definition: connectorDefinitions,
      })
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
      .limit(1);

    if (!connector) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }

    return connector;
  }),

  // Install a connector
  install: protectedProcedure
    .input(
      z.object({
        connectorDefinitionId: z.string(),
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if connector definition exists
      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.id, input.connectorDefinitionId))
        .limit(1);

      if (!definition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector definition not found",
        });
      }

      // Check if already installed
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(
          and(
            eq(userConnectors.userId, ctx.user.id),
            eq(userConnectors.connectorDefinitionId, input.connectorDefinitionId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Connector already installed",
        });
      }

      const id = createId();
      const [connector] = await db
        .insert(userConnectors)
        .values({
          id,
          userId: ctx.user.id,
          connectorDefinitionId: input.connectorDefinitionId,
          organizationId: input.organizationId,
          status: "pending",
        })
        .returning();

      return connector;
    }),

  // Update connector config
  updateConfig: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        config: z.record(z.unknown()).optional(),
        syncEnabled: z.boolean().optional(),
        syncInterval: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set(updates)
        .where(eq(userConnectors.id, id))
        .returning();

      return connector;
    }),

  // Save OAuth tokens
  saveTokens: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        tokenExpiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...tokenData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set({
          ...tokenData,
          status: "connected",
        })
        .where(eq(userConnectors.id, id))
        .returning();

      return connector;
    }),

  // Disconnect a connector
  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set({
          status: "disconnected",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        })
        .where(eq(userConnectors.id, input.id))
        .returning();

      return connector;
    }),

  // Uninstall a connector
  uninstall: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      await db.delete(userConnectors).where(eq(userConnectors.id, input.id));

      return { success: true };
    }),

  // Trigger sync
  sync: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(userConnectors)
      .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }

    if (existing.status !== "connected") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Connector is not connected",
      });
    }

    // Create sync log
    const logId = createId();
    await db.insert(connectorSyncLogs).values({
      id: logId,
      userConnectorId: input.id,
      status: "started",
    });

    // Update connector status
    await db
      .update(userConnectors)
      .set({ status: "syncing" })
      .where(eq(userConnectors.id, input.id));

    // TODO: Trigger actual sync job via queue/worker

    return { syncLogId: logId };
  }),

  // Initialize OAuth via connector service (Composio)
  initializeOAuth: protectedProcedure
    .input(
      z.object({
        type: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connectorServiceUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      const response = await fetch(`${connectorServiceUrl}/connectors/${input.type}/oauth/start`, {
        headers: {
          "x-user-id": ctx.user.id,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TRPCError({
          code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: (error as { error?: string }).error || "Failed to initialize OAuth",
        });
      }

      const data = (await response.json()) as {
        authUrl: string;
        connectorId: string;
      };
      return data;
    }),

  // Get tools for an integration via connector service (Composio)
  getTools: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connectorServiceUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      const response = await fetch(
        `${connectorServiceUrl}/integrations/${input.integrationId}/tools`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TRPCError({
          code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: (error as { error?: string }).error || "Failed to fetch tools",
        });
      }

      const data = (await response.json()) as {
        tools: Array<{
          name: string;
          description: string;
          parameters: Record<string, unknown>;
          appName: string;
        }>;
      };
      return data.tools;
    }),

  // Get sync history
  getSyncHistory: protectedProcedure
    .input(
      z.object({
        connectorId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [connector] = await db
        .select()
        .from(userConnectors)
        .where(
          and(eq(userConnectors.id, input.connectorId), eq(userConnectors.userId, ctx.user.id))
        )
        .limit(1);

      if (!connector) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const logs = await db
        .select()
        .from(connectorSyncLogs)
        .where(eq(connectorSyncLogs.userConnectorId, input.connectorId))
        .orderBy(desc(connectorSyncLogs.startedAt))
        .limit(input.limit);

      return logs;
    }),
});
