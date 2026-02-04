"use client";

import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { useSettings, type SettingsTab } from "./settings-context";
import { AccountTab } from "./tabs/account-tab";
import { BillingTab } from "./tabs/billing-tab";
import { ConnectorsTab } from "./tabs/connectors-tab";
import { DataControlsTab } from "./tabs/data-controls-tab";
import { DevicesTab } from "./tabs/devices-tab";
import { HelpTab } from "./tabs/help-tab";
import { IntegrationsTab } from "./tabs/integrations-tab";
import { MailManusTab } from "./tabs/mail-manus-tab";
import { PersonalizationTab } from "./tabs/personalization-tab";
import { PlaceholderTab } from "./tabs/placeholder-tab";
import { ScheduledTasksTab } from "./tabs/scheduled-tasks-tab";
import { SettingsTab as SettingsTabComponent } from "./tabs/settings-tab";
import { SkillsTab } from "./tabs/skills-tab";
import { UsageTab } from "./tabs/usage-tab";

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
  devices: {
    title: "Devices",
    description: "Manage your connected devices",
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
      case "devices":
        return <DevicesTab />;
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
