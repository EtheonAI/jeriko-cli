"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { XIcon, FileIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { ScrollArea, ScrollBar } from "@repo/design-system/components/ui/scroll-area";

interface TabInfo {
  id: string;
  name: string;
}

interface EditorTabsProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
}

export function EditorTabs({ tabs, activeTabId, onSelectTab, onCloseTab }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="border-b bg-muted/30">
      <ScrollArea className="w-full">
        <div className="flex">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 border-r px-3 py-1.5 text-sm cursor-pointer",
                activeTabId === tab.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-background/50"
              )}
              onClick={() => onSelectTab(tab.id)}
            >
              <FileIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[120px]">{tab.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
