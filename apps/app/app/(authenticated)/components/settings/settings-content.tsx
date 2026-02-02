"use client";

import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { useSettings, type SettingsTab } from "./settings-context";
import { AccountTab } from "./tabs/account-tab";
import { BillingTab } from "./tabs/billing-tab";
import { PlaceholderTab } from "./tabs/placeholder-tab";
import { SettingsTab as SettingsTabComponent } from "./tabs/settings-tab";
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
  connectors: { title: "Connectors", description: "Manage API connections" },
  integrations: {
    title: "Integrations",
    description: "Connect third-party applications",
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
      default:
        return (
          <PlaceholderTab
            title={tabConfig[activeTab].title}
            description={tabConfig[activeTab].description}
          />
        );
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6">{renderTabContent()}</div>
    </ScrollArea>
  );
}
