"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  LinkIcon,
  SettingsIcon,
  Loader2Icon,
  GithubIcon,
  MailIcon,
  MessageSquareIcon,
  FolderIcon,
  FileTextIcon,
  CalendarIcon,
  TrelloIcon,
  BarChart3Icon,
  CreditCardIcon,
  WebhookIcon,
  ZapIcon,
  CloudIcon,
  DatabaseIcon,
  UsersIcon,
  PenToolIcon,
  RocketIcon,
  BugIcon,
  CheckSquareIcon,
  VideoIcon,
  TableIcon,
  ShoppingCartIcon,
  HeadphonesIcon,
  TicketIcon,
  HashIcon,
  MusicIcon,
  PlayCircleIcon,
  LinkIcon as DefaultIcon,
} from "lucide-react";
import { AppStatusBadge } from "./app-status-badge";
import type { ConnectorDefinition, UserConnector } from "@repo/database";

const connectorIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github: GithubIcon,
  gitlab: GithubIcon,
  bitbucket: GithubIcon,
  gmail: MailIcon,
  outlook: MailIcon,
  slack: MessageSquareIcon,
  discord: MessageSquareIcon,
  teams: MessageSquareIcon,
  google_drive: FolderIcon,
  dropbox: FolderIcon,
  onedrive: FolderIcon,
  box: FolderIcon,
  sharepoint: FolderIcon,
  notion: FileTextIcon,
  confluence: FileTextIcon,
  google_calendar: CalendarIcon,
  jira: TrelloIcon,
  linear: TrelloIcon,
  asana: TrelloIcon,
  trello: TrelloIcon,
  google_analytics: BarChart3Icon,
  mixpanel: BarChart3Icon,
  amplitude: BarChart3Icon,
  stripe_connector: CreditCardIcon,
  quickbooks: CreditCardIcon,
  xero: CreditCardIcon,
  salesforce: UsersIcon,
  hubspot: UsersIcon,
  pipedrive: UsersIcon,
  zapier: ZapIcon,
  make_connector: ZapIcon,
  custom_webhook: WebhookIcon,
  mailchimp: MailIcon,
  sendgrid: MailIcon,
  twilio: MessageSquareIcon,
  telegram: MessageSquareIcon,
  figma: PenToolIcon,
  vercel: RocketIcon,
  sentry: BugIcon,
  todoist: CheckSquareIcon,
  clickup: CheckSquareIcon,
  airtable: TableIcon,
  google_sheets: TableIcon,
  google_docs: FileTextIcon,
  zoom: VideoIcon,
  zendesk: HeadphonesIcon,
  intercom: HeadphonesIcon,
  freshdesk: TicketIcon,
  shopify: ShoppingCartIcon,
  twitter: HashIcon,
  reddit: MessageSquareIcon,
  spotify: MusicIcon,
  youtube: PlayCircleIcon,
};

const categoryColors: Record<string, string> = {
  communication: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  storage: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  productivity: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  development: "bg-green-500/10 text-green-600 dark:text-green-400",
  crm: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  analytics: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

interface AppCardProps {
  definition: ConnectorDefinition;
  connection?: {
    connector: UserConnector;
    definition: ConnectorDefinition;
  };
  onConnect: (definitionId: string, type: string) => void;
  onConfigure: (connectorId: string) => void;
  isConnecting?: boolean;
}

export function AppCard({
  definition,
  connection,
  onConnect,
  onConfigure,
  isConnecting,
}: AppCardProps) {
  const Icon = connectorIcons[definition.type] ?? DefaultIcon;
  const isConnected = connection?.connector.status === "connected";
  const hasConnection = !!connection;
  const categoryColor = categoryColors[definition.category] ?? categoryColors.other;

  return (
    <div
      className="group relative flex flex-col rounded-lg border p-4 transition-colors hover:bg-accent/50 cursor-pointer"
      onClick={() => {
        if (hasConnection) {
          onConfigure(connection.connector.id);
        } else {
          onConnect(definition.id, definition.type);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {definition.icon ? (
            <img
              src={definition.icon}
              alt={definition.name}
              className="h-6 w-6 rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <Icon className={`h-5 w-5 ${definition.icon ? "hidden" : ""}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{definition.name}</span>
            {definition.isPremium && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Pro
              </Badge>
            )}
          </div>
          <span
            className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor}`}
          >
            {definition.category}
          </span>
        </div>
      </div>

      {definition.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{definition.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {hasConnection ? <AppStatusBadge status={connection.connector.status} /> : <div />}

        {hasConnection ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure(connection.connector.id);
            }}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            Configure
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={isConnecting}
            onClick={(e) => {
              e.stopPropagation();
              onConnect(definition.id, definition.type);
            }}
          >
            {isConnecting ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LinkIcon className="h-3.5 w-3.5" />
            )}
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
