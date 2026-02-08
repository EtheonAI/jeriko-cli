"use client";

import * as React from "react";
import { useState } from "react";
import { CodeIcon, DatabaseIcon, CloudIcon, SettingsIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { CodeView, type FileNode, type FileTab } from "./code-view";

// ============================================================================
// Types
// ============================================================================

export interface WebDevIDEViewProps {
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  onSelectFile?: (path: string) => void;
  onSelectTab?: (id: string) => void;
}

const IDE_TABS = [
  { id: "code", label: "Code", Icon: CodeIcon },
  { id: "database", label: "Database", Icon: DatabaseIcon },
  { id: "storage", label: "Storage", Icon: CloudIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
] as const;

// ============================================================================
// Component
// ============================================================================

export function WebDevIDEView({
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  onSelectFile,
  onSelectTab,
}: WebDevIDEViewProps) {
  const [activeTab, setActiveTab] = useState<string>("code");

  return (
    <div className="flex h-full flex-col">
      {/* Top tab bar */}
      <div className="flex items-center border-b border-border/10 bg-canvas-surface">
        {IDE_TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-blue-500 bg-canvas-deep text-foreground"
                : "text-muted-foreground/50 hover:bg-muted/10 hover:text-muted-foreground/70"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.Icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "code" && (
          <CodeView
            fileTree={fileTree}
            fileTabs={fileTabs}
            activeFileContent={activeFileContent}
            activeFileLanguage={activeFileLanguage}
            onSelectFile={onSelectFile}
            onSelectTab={onSelectTab}
          />
        )}
        {activeTab === "database" && (
          <PlaceholderTab Icon={DatabaseIcon} label="Database Browser" color="text-yellow-400" />
        )}
        {activeTab === "storage" && (
          <PlaceholderTab Icon={CloudIcon} label="Cloud Storage" color="text-blue-400" />
        )}
        {activeTab === "settings" && (
          <PlaceholderTab
            Icon={SettingsIcon}
            label="Project Settings"
            color="text-muted-foreground/50"
          />
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({
  Icon,
  label,
  color,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-canvas-deep">
      <div className="text-center text-muted-foreground/40">
        <Icon className={cn("mx-auto mb-3 size-12 opacity-30", color)} />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
