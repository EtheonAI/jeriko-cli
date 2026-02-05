import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { connectorDefinitions } from "./schema/connectors";
import { createId } from "@paralleldrive/cuid2";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Set it in packages/database/.env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

interface AppSeed {
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
  capabilities: string[];
  isPremium?: boolean;
}

const apps: AppSeed[] = [
  // Communication
  {
    type: "gmail",
    name: "Gmail",
    description:
      "Send, read, and manage emails. Search inbox, create drafts, and organize messages.",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/gmail",
    capabilities: ["send_email", "read_email", "search_inbox", "create_draft", "manage_labels"],
  },
  {
    type: "outlook",
    name: "Outlook",
    description: "Microsoft email and calendar. Send emails, manage events, and organize contacts.",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftoutlook",
    capabilities: ["send_email", "read_email", "manage_calendar", "manage_contacts"],
  },
  {
    type: "slack",
    name: "Slack",
    description:
      "Team messaging and collaboration. Send messages, manage channels, and search conversations.",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/slack",
    capabilities: ["send_message", "read_messages", "manage_channels", "search", "upload_files"],
  },
  {
    type: "discord",
    name: "Discord",
    description: "Community platform for text, voice, and video. Send messages and manage servers.",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/discord",
    capabilities: ["send_message", "read_messages", "manage_channels"],
  },
  {
    type: "teams",
    name: "Microsoft Teams",
    description: "Microsoft collaboration hub. Chat, meet, call, and collaborate in one place.",
    category: "communication",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftteams",
    capabilities: ["send_message", "read_messages", "schedule_meeting"],
  },
  {
    type: "twilio",
    name: "Twilio",
    description: "Cloud communications platform. Send SMS, make calls, and manage phone numbers.",
    category: "communication",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/twilio",
    capabilities: ["send_sms", "make_call", "manage_numbers"],
  },

  // Storage
  {
    type: "google_drive",
    name: "Google Drive",
    description:
      "Cloud file storage and collaboration. Upload, share, and organize files and folders.",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googledrive",
    capabilities: ["upload_file", "download_file", "share", "search", "manage_folders"],
  },
  {
    type: "dropbox",
    name: "Dropbox",
    description: "Cloud storage and file sharing. Sync files across devices and share with teams.",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/dropbox",
    capabilities: ["upload_file", "download_file", "share", "search"],
  },
  {
    type: "onedrive",
    name: "OneDrive",
    description: "Microsoft cloud storage. Store, sync, and share files with Office integration.",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftonedrive",
    capabilities: ["upload_file", "download_file", "share", "search"],
  },
  {
    type: "box",
    name: "Box",
    description: "Enterprise cloud content management. Secure file sharing and collaboration.",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/box",
    capabilities: ["upload_file", "download_file", "share", "manage_folders"],
    isPremium: true,
  },
  {
    type: "sharepoint",
    name: "SharePoint",
    description: "Microsoft enterprise content management. Document libraries and team sites.",
    category: "storage",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/microsoftsharepoint",
    capabilities: ["upload_file", "download_file", "manage_sites", "search"],
    isPremium: true,
  },

  // Productivity
  {
    type: "notion",
    name: "Notion",
    description: "All-in-one workspace for notes, docs, wikis, and project management.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/notion",
    capabilities: ["create_page", "update_page", "search", "manage_databases", "create_comment"],
  },
  {
    type: "google_calendar",
    name: "Google Calendar",
    description: "Schedule and manage events, set reminders, and coordinate meetings.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googlecalendar",
    capabilities: ["create_event", "update_event", "list_events", "manage_calendars"],
  },
  {
    type: "asana",
    name: "Asana",
    description: "Work management platform. Create tasks, track projects, and manage teams.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/asana",
    capabilities: ["create_task", "update_task", "manage_projects", "assign_task"],
  },
  {
    type: "trello",
    name: "Trello",
    description: "Visual project management with boards, lists, and cards. Organize anything.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/trello",
    capabilities: ["create_card", "update_card", "manage_boards", "manage_lists"],
  },
  {
    type: "todoist",
    name: "Todoist",
    description:
      "Task management and to-do lists. Organize tasks with projects, labels, and priorities.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/todoist",
    capabilities: ["create_task", "complete_task", "manage_projects", "set_reminders"],
  },
  {
    type: "confluence",
    name: "Confluence",
    description: "Team wiki and knowledge base. Create, share, and collaborate on documentation.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/confluence",
    capabilities: ["create_page", "update_page", "search", "manage_spaces"],
    isPremium: true,
  },
  {
    type: "airtable",
    name: "Airtable",
    description: "Flexible database and spreadsheet hybrid. Build apps and workflows without code.",
    category: "productivity",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/airtable",
    capabilities: ["create_record", "update_record", "list_records", "manage_bases"],
  },

  // Development
  {
    type: "github",
    name: "GitHub",
    description:
      "Code hosting and collaboration. Manage repos, issues, pull requests, and actions.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/github",
    capabilities: [
      "create_issue",
      "create_pr",
      "list_repos",
      "manage_branches",
      "review_code",
      "star_repo",
    ],
  },
  {
    type: "gitlab",
    name: "GitLab",
    description: "DevOps platform with Git repos, CI/CD, issue tracking, and more.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/gitlab",
    capabilities: ["create_issue", "create_mr", "list_projects", "manage_pipelines"],
  },
  {
    type: "bitbucket",
    name: "Bitbucket",
    description: "Atlassian Git solution for teams. Code repos, CI/CD, and Jira integration.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/bitbucket",
    capabilities: ["create_issue", "create_pr", "list_repos", "manage_pipelines"],
  },
  {
    type: "jira",
    name: "Jira",
    description: "Project and issue tracking for agile teams. Plan, track, and release software.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/jira",
    capabilities: ["create_issue", "update_issue", "search", "manage_sprints", "transition_issue"],
  },
  {
    type: "linear",
    name: "Linear",
    description:
      "Modern issue tracking for high-performance teams. Streamlined project management.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/linear",
    capabilities: [
      "create_issue",
      "update_issue",
      "list_issues",
      "manage_projects",
      "manage_cycles",
    ],
  },
  {
    type: "vercel",
    name: "Vercel",
    description: "Frontend deployment platform. Deploy, preview, and scale web applications.",
    category: "development",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/vercel",
    capabilities: ["list_deployments", "create_deployment", "manage_domains", "view_logs"],
  },
  {
    type: "sentry",
    name: "Sentry",
    description: "Error monitoring and performance tracking. Debug crashes and fix issues faster.",
    category: "development",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/sentry",
    capabilities: ["list_issues", "resolve_issue", "view_events"],
  },

  // CRM
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Enterprise CRM platform. Manage leads, contacts, opportunities, and accounts.",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/salesforce",
    capabilities: [
      "create_lead",
      "update_contact",
      "manage_opportunities",
      "search",
      "create_task",
    ],
    isPremium: true,
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "CRM, marketing, sales, and service platform. Manage contacts and deals.",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/hubspot",
    capabilities: ["create_contact", "update_deal", "manage_companies", "send_email", "search"],
  },
  {
    type: "pipedrive",
    name: "Pipedrive",
    description: "Sales CRM and pipeline management. Track deals and automate sales activities.",
    category: "crm",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/pipedrive",
    capabilities: ["create_deal", "update_deal", "manage_contacts", "manage_activities"],
  },

  // Analytics
  {
    type: "google_analytics",
    name: "Google Analytics",
    description: "Web analytics service. Track website traffic, user behavior, and conversions.",
    category: "analytics",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/googleanalytics",
    capabilities: ["get_reports", "list_properties", "view_realtime"],
  },
  {
    type: "mixpanel",
    name: "Mixpanel",
    description: "Product analytics platform. Track user actions and build custom reports.",
    category: "analytics",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/mixpanel",
    capabilities: ["track_event", "query_data", "manage_funnels"],
  },
  {
    type: "amplitude",
    name: "Amplitude",
    description: "Digital analytics platform. Understand user behavior and drive growth.",
    category: "analytics",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/amplitude",
    capabilities: ["track_event", "query_data", "view_charts"],
  },

  // Other / Automation
  {
    type: "zapier",
    name: "Zapier",
    description: "Automation platform connecting 6,000+ apps. Create workflows without code.",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/zapier",
    capabilities: ["trigger_zap", "list_zaps", "manage_connections"],
  },
  {
    type: "stripe_connector",
    name: "Stripe",
    description: "Payment processing platform. Manage payments, subscriptions, and invoices.",
    category: "other",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/stripe",
    capabilities: ["create_payment", "list_charges", "manage_subscriptions", "create_invoice"],
  },
  {
    type: "sendgrid",
    name: "SendGrid",
    description: "Email delivery service. Send transactional and marketing emails at scale.",
    category: "communication",
    authType: "api_key",
    icon: "https://cdn.simpleicons.org/sendgrid",
    capabilities: ["send_email", "manage_templates", "view_stats"],
  },
  {
    type: "mailchimp",
    name: "Mailchimp",
    description: "Email marketing and automation platform. Build campaigns and grow your audience.",
    category: "other",
    authType: "oauth2",
    icon: "https://cdn.simpleicons.org/mailchimp",
    capabilities: ["create_campaign", "manage_lists", "send_email", "view_reports"],
  },
  {
    type: "custom_webhook",
    name: "Custom Webhook",
    description: "Connect any service via webhooks. Send and receive HTTP requests.",
    category: "other",
    authType: "custom",
    icon: null,
    capabilities: ["send_webhook", "receive_webhook"],
  },
];

async function seed() {
  console.log(`Seeding ${apps.length} connector definitions...`);

  let inserted = 0;
  let updated = 0;

  for (const app of apps) {
    try {
      const result = await db
        .insert(connectorDefinitions)
        .values({
          id: createId(),
          type: app.type,
          name: app.name,
          description: app.description,
          icon: app.icon,
          category: app.category,
          authType: app.authType,
          capabilities: app.capabilities,
          isEnabled: true,
          isPremium: app.isPremium ?? false,
        })
        .onConflictDoUpdate({
          target: connectorDefinitions.type,
          set: {
            name: app.name,
            description: app.description,
            icon: app.icon,
            category: app.category,
            authType: app.authType,
            capabilities: app.capabilities,
            isPremium: app.isPremium ?? false,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (result[0]) {
        // Check if it was an insert or update by comparing timestamps
        const record = result[0];
        const timeDiff = Math.abs(record.createdAt.getTime() - record.updatedAt.getTime());
        if (timeDiff < 1000) {
          inserted++;
        } else {
          updated++;
        }
      }
    } catch (error) {
      console.error(`Failed to upsert ${app.type}:`, error);
    }
  }

  console.log(`Done! Inserted: ${inserted}, Updated: ${updated}, Total: ${apps.length}`);
}

seed().catch(console.error);
