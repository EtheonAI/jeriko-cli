"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import {
  CalendarIcon,
  CreditCardIcon,
  DatabaseIcon,
  HelpCircleIcon,
  LinkIcon,
  MailIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import { type SettingsTab, useSettings } from "./settings-context";

type NavItem = {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "usage", label: "Usage", icon: ZapIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "scheduled-tasks", label: "Scheduled tasks", icon: CalendarIcon },
  { id: "mail", label: "Mail Manus", icon: MailIcon },
  { id: "data-controls", label: "Data controls", icon: DatabaseIcon },
  { id: "personalization", label: "Personalization", icon: PaletteIcon },
  { id: "skills", label: "Skills", icon: SparklesIcon },
  { id: "connectors", label: "Connectors", icon: PlugIcon },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
  { id: "help", label: "Get help", icon: HelpCircleIcon },
];

export function SettingsNav() {
  const { activeTab, setActiveTab } = useSettings();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 h-9",
              isActive && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveTab(item.id)}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
