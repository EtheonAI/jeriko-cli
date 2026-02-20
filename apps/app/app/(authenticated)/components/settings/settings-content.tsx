"use client";

import dynamic from "next/dynamic";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useSettings, type SettingsTab } from "./settings-context";
import { PlaceholderTab } from "./tabs/placeholder-tab";

// Lazy-load all settings tabs — only the active tab's JS is downloaded.
// This saves ~100KB+ from the initial bundle since most users never open settings.
const TabLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-72" />
    <div className="space-y-3 mt-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  </div>
);

const AccountTab = dynamic(() => import("./tabs/account-tab").then((m) => ({ default: m.AccountTab })), { loading: TabLoading });
const BillingTab = dynamic(() => import("./tabs/billing-tab").then((m) => ({ default: m.BillingTab })), { loading: TabLoading });
const ConnectorsTab = dynamic(() => import("./tabs/connectors-tab").then((m) => ({ default: m.ConnectorsTab })), { loading: TabLoading });
const DataControlsTab = dynamic(() => import("./tabs/data-controls-tab").then((m) => ({ default: m.DataControlsTab })), { loading: TabLoading });
const HelpTab = dynamic(() => import("./tabs/help-tab").then((m) => ({ default: m.HelpTab })), { loading: TabLoading });
const IntegrationsTab = dynamic(() => import("./tabs/integrations-tab").then((m) => ({ default: m.IntegrationsTab })), { loading: TabLoading });
const MailManusTab = dynamic(() => import("./tabs/mail-manus-tab").then((m) => ({ default: m.MailManusTab })), { loading: TabLoading });
const PersonalizationTab = dynamic(() => import("./tabs/personalization-tab").then((m) => ({ default: m.PersonalizationTab })), { loading: TabLoading });
const ScheduledTasksTab = dynamic(() => import("./tabs/scheduled-tasks-tab").then((m) => ({ default: m.ScheduledTasksTab })), { loading: TabLoading });
const SettingsTabComponent = dynamic(() => import("./tabs/settings-tab").then((m) => ({ default: m.SettingsTab })), { loading: TabLoading });
const SkillsTab = dynamic(() => import("./tabs/skills-tab").then((m) => ({ default: m.SkillsTab })), { loading: TabLoading });
const SecretsTab = dynamic(() => import("./tabs/secrets-tab").then((m) => ({ default: m.SecretsTab })), { loading: TabLoading });
const UsageTab = dynamic(() => import("./tabs/usage-tab").then((m) => ({ default: m.UsageTab })), { loading: TabLoading });

type SettingsContentProps = {
  user?: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isPro?: boolean;
};

const tabConfig: Record<
  SettingsTab,
  { title: string; description?: string }
> = {
  account: { title: "Account", description: "Manage your account settings" },
  settings: { title: "Settings", description: "Customize your experience" },
  usage: { title: "Usage", description: "Monitor your credit usage" },
  billing: { title: "Billing", description: "Manage your subscription" },
  "scheduled-tasks": {
    title: "Scheduled Tasks",
    description: "Automate your recurring tasks",
  },
  connectors: { title: "Connectors", description: "Connect third-party services" },
  mail: { title: "Mail Manus", description: "Configure email integration" },
  "data-controls": {
    title: "Data Controls",
    description: "Manage your data and privacy",
  },
  personalization: {
    title: "Personalization",
    description: "Customize your theme and preferences",
  },
  skills: { title: "Skills", description: "Configure AI capabilities" },
  integrations: {
    title: "Integrations",
    description: "Webhooks and API connections",
  },
  secrets: {
    title: "Secrets",
    description: "Environment variables injected into your sandbox",
  },
  help: { title: "Get Help", description: "Documentation and support" },
};

export function SettingsContent({ user, isPro = false }: SettingsContentProps) {
  const { activeTab } = useSettings();

  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return <AccountTab user={user} />;
      case "settings":
        return <SettingsTabComponent />;
      case "usage":
        return <UsageTab isPro={isPro} />;
      case "billing":
        return <BillingTab isPro={isPro} />;
      case "scheduled-tasks":
        return <ScheduledTasksTab />;
      case "connectors":
        return <ConnectorsTab />;
      case "mail":
        return <MailManusTab />;
      case "data-controls":
        return <DataControlsTab />;
      case "personalization":
        return <PersonalizationTab />;
      case "skills":
        return <SkillsTab />;
      case "integrations":
        return <IntegrationsTab />;
      case "secrets":
        return <SecretsTab />;
      case "help":
        return <HelpTab />;
      default: {
        // This default case handles any future tabs not yet implemented
        const tab = activeTab as keyof typeof tabConfig;
        return (
          <PlaceholderTab
            title={tabConfig[tab]?.title || "Coming Soon"}
            description={tabConfig[tab]?.description}
          />
        );
      }
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6">{renderTabContent()}</div>
    </ScrollArea>
  );
}
