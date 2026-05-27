import { createId } from "@repo/service-utils";
import { db, connectorDefinitions, type NewConnectorDefinition } from "../lib/db.js";

const SEED_CONNECTORS: Omit<NewConnectorDefinition, "id">[] = [
  {
    type: "github",
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and more",
    icon: "github",
    category: "development",
    authType: "oauth2",
    capabilities: ["create_issue", "list_repos", "create_pr", "review_pr", "list_commits"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "gmail",
    name: "Gmail",
    description: "Send, read, and manage emails",
    icon: "mail",
    category: "communication",
    authType: "oauth2",
    capabilities: ["send_email", "read_email", "search_email", "manage_labels"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "google_drive",
    name: "Google Drive",
    description: "Manage files and folders in Google Drive",
    icon: "hard-drive",
    category: "storage",
    authType: "oauth2",
    capabilities: ["upload_file", "download_file", "list_files", "create_folder", "share_file"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "google_calendar",
    name: "Google Calendar",
    description: "Create and manage calendar events",
    icon: "calendar",
    category: "productivity",
    authType: "oauth2",
    capabilities: ["create_event", "list_events", "update_event", "delete_event"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "slack",
    name: "Slack",
    description: "Send messages, manage channels, and automate workflows",
    icon: "message-square",
    category: "communication",
    authType: "oauth2",
    capabilities: ["send_message", "list_channels", "create_channel", "upload_file"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "notion",
    name: "Notion",
    description: "Create and manage Notion pages, databases, and blocks",
    icon: "book-open",
    category: "productivity",
    authType: "oauth2",
    capabilities: ["create_page", "update_page", "query_database", "create_database"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "linear",
    name: "Linear",
    description: "Manage issues, projects, and cycles in Linear",
    icon: "layout",
    category: "development",
    authType: "oauth2",
    capabilities: ["create_issue", "list_issues", "update_issue", "create_project"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "jira",
    name: "Jira",
    description: "Manage Jira issues, boards, and sprints",
    icon: "clipboard",
    category: "development",
    authType: "oauth2",
    capabilities: ["create_issue", "list_issues", "update_issue", "transition_issue"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "confluence",
    name: "Confluence",
    description: "Create and manage Confluence pages and spaces",
    icon: "file-text",
    category: "productivity",
    authType: "oauth2",
    capabilities: ["create_page", "update_page", "search", "list_spaces"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "dropbox",
    name: "Dropbox",
    description: "Upload, download, and manage files in Dropbox",
    icon: "box",
    category: "storage",
    authType: "oauth2",
    capabilities: ["upload_file", "download_file", "list_files", "create_folder"],
    isEnabled: true,
    isPremium: false,
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Manage leads, contacts, opportunities, and accounts",
    icon: "cloud",
    category: "crm",
    authType: "oauth2",
    capabilities: ["create_lead", "list_contacts", "create_opportunity", "search_records"],
    isEnabled: true,
    isPremium: true,
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Manage contacts, deals, and marketing in HubSpot",
    icon: "users",
    category: "crm",
    authType: "oauth2",
    capabilities: ["create_contact", "list_deals", "create_deal", "send_email"],
    isEnabled: true,
    isPremium: true,
  },
];

async function seed() {
  console.log("Seeding connector definitions...");

  let upserted = 0;
  for (const connector of SEED_CONNECTORS) {
    await db
      .insert(connectorDefinitions)
      .values({
        id: createId(),
        ...connector,
      })
      .onConflictDoUpdate({
        target: connectorDefinitions.type,
        set: {
          name: connector.name,
          description: connector.description,
          icon: connector.icon,
          category: connector.category,
          capabilities: connector.capabilities,
          isEnabled: connector.isEnabled,
          isPremium: connector.isPremium,
          updatedAt: new Date(),
        },
      });

    upserted++;
    console.log(`  -> ${connector.type}: ${connector.name}`);
  }

  console.log(`\nSeeded ${upserted} connector definitions.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
