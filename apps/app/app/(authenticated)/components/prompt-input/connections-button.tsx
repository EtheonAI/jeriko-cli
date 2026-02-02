"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { cn } from "@repo/design-system/lib/utils";
import { PuzzleIcon, MailIcon, CalendarIcon, GlobeIcon, FolderIcon } from "lucide-react";
import { useState } from "react";
import type { ConnectedApp } from "./types";

type ConnectionsButtonProps = {
  apps: ConnectedApp[];
  selectedApps: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
};

const appIcons: Record<ConnectedApp["type"], React.ReactNode> = {
  email: <MailIcon className="h-4 w-4" />,
  calendar: <CalendarIcon className="h-4 w-4" />,
  browser: <GlobeIcon className="h-4 w-4" />,
  storage: <FolderIcon className="h-4 w-4" />,
  custom: <PuzzleIcon className="h-4 w-4" />,
};

// Sample connected apps for demo
const defaultApps: ConnectedApp[] = [
  { id: "gmail", name: "Gmail", icon: "", type: "email", connected: true },
  { id: "calendar", name: "Google Calendar", icon: "", type: "calendar", connected: true },
  { id: "browser", name: "Browser", icon: "", type: "browser", connected: true },
  { id: "drive", name: "Google Drive", icon: "", type: "storage", connected: true },
];

export function ConnectionsButton({
  apps = defaultApps,
  selectedApps,
  onSelectionChange,
  disabled = false,
  className,
}: ConnectionsButtonProps) {
  const [open, setOpen] = useState(false);

  const connectedApps = apps.filter((app) => app.connected);
  const selectedCount = selectedApps.length;

  const toggleApp = (appId: string) => {
    if (selectedApps.includes(appId)) {
      onSelectionChange(selectedApps.filter((id) => id !== appId));
    } else {
      onSelectionChange([...selectedApps, appId]);
    }
  };

  if (connectedApps.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className={cn(
                "h-8 rounded-full border-border/60 hover:bg-accent gap-1 px-2 shrink-0",
                selectedCount > 0 && "border-primary/50",
                className
              )}
            >
              <div className="flex items-center gap-1">
                {selectedApps.slice(0, 3).map((appId) => {
                  const app = connectedApps.find((a) => a.id === appId);
                  if (!app) return null;
                  return (
                    <div
                      key={appId}
                      className="flex items-center justify-center h-4 w-4 rounded bg-muted"
                    >
                      {appIcons[app.type]}
                    </div>
                  );
                })}
                {selectedApps.length === 0 && (
                  <PuzzleIcon className="h-4 w-4" />
                )}
                {selectedCount > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{selectedCount - 3}
                  </span>
                )}
              </div>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          {selectedCount > 0 ? `${selectedCount} app(s) selected` : "Connect apps"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Connected Applications</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Select apps to include context in your prompt
          </p>
        </div>
        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
          {connectedApps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => toggleApp(app.id)}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
            >
              <Checkbox
                checked={selectedApps.includes(app.id)}
                onCheckedChange={() => toggleApp(app.id)}
              />
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted">
                {appIcons[app.type]}
              </div>
              <span className="text-sm flex-1">{app.name}</span>
            </button>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary"
            asChild
          >
            <a href="/applications">Manage connections</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
