"use client";

import * as React from "react";
import { useState, useMemo, useRef } from "react";
import {
  CodeIcon,
  EyeIcon,
  DatabaseIcon,
  SettingsIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  SmartphoneIcon,
  TabletIcon,
  MonitorIcon,
} from "lucide-react";
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
  onCloseTab?: (id: string) => void;
  /** External preview URL (from sandbox exposed port) */
  previewUrl?: string;
  /** All file contents for composing preview HTML */
  fileContents?: Record<string, string>;
}

type IDETab = "code" | "preview" | "database" | "settings";

const IDE_TABS: { id: IDETab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "code", label: "Code", Icon: CodeIcon },
  { id: "preview", label: "Preview", Icon: EyeIcon },
  { id: "database", label: "Database", Icon: DatabaseIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

type ViewportSize = "mobile" | "tablet" | "desktop";

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  mobile: { width: "375px", label: "Mobile", icon: SmartphoneIcon },
  tablet: { width: "768px", label: "Tablet", icon: TabletIcon },
  desktop: { width: "100%", label: "Desktop", icon: MonitorIcon },
};

// ============================================================================
// Preview builder — compose HTML from fileContents
// ============================================================================

function buildPreviewHtml(fileContents: Record<string, string>): string | null {
  // Look for an index.html first
  const htmlFile = findFile(fileContents, ["index.html", "main.html", "page.html"]);
  if (htmlFile) {
    let html = htmlFile;

    // Inject CSS files inline if they exist
    const cssFiles = Object.entries(fileContents).filter(([k]) =>
      k.endsWith(".css")
    );
    if (cssFiles.length > 0) {
      const cssBlock = cssFiles.map(([, css]) => `<style>${css}</style>`).join("\n");
      // Insert before </head> or at the start
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${cssBlock}\n</head>`);
      } else if (html.includes("<body")) {
        html = html.replace("<body", `${cssBlock}\n<body`);
      } else {
        html = cssBlock + "\n" + html;
      }
    }

    // Inject JS files inline
    const jsFiles = Object.entries(fileContents).filter(([k]) =>
      k.endsWith(".js") || k.endsWith(".mjs")
    );
    if (jsFiles.length > 0) {
      const jsBlock = jsFiles.map(([, js]) => `<script>${js}</script>`).join("\n");
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${jsBlock}\n</body>`);
      } else {
        html = html + "\n" + jsBlock;
      }
    }

    return html;
  }

  // No HTML file — try to compose from React/JSX or just CSS+JS
  const cssContent = Object.entries(fileContents)
    .filter(([k]) => k.endsWith(".css"))
    .map(([, v]) => v)
    .join("\n");

  const jsContent = Object.entries(fileContents)
    .filter(([k]) => k.endsWith(".js") || k.endsWith(".mjs"))
    .map(([, v]) => v)
    .join("\n");

  if (!cssContent && !jsContent) return null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script>${jsContent}</script>
</body>
</html>`;
}

function findFile(fileContents: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    for (const [path, content] of Object.entries(fileContents)) {
      if (path.endsWith(`/${name}`) || path === name) {
        return content;
      }
    }
  }
  return null;
}

// ============================================================================
// Preview Panel
// ============================================================================

function PreviewPanel({
  previewUrl,
  fileContents,
}: {
  previewUrl?: string;
  fileContents?: Record<string, string>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  // Build preview HTML from file contents
  const previewHtml = useMemo(() => {
    if (previewUrl) return null; // Use URL instead
    if (!fileContents || Object.keys(fileContents).length === 0) return null;
    return buildPreviewHtml(fileContents);
  }, [previewUrl, fileContents]);

  // Write HTML to iframe via srcdoc or blob URL
  const srcDoc = useMemo(() => {
    if (previewUrl) return undefined;
    return previewHtml ?? undefined;
  }, [previewUrl, previewHtml]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    if (previewUrl && iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } else if (previewHtml) {
      const blob = new Blob([previewHtml], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    }
  };

  const hasPreview = previewUrl || previewHtml;

  return (
    <div className="flex h-full flex-col bg-canvas-deep">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between border-b border-border/10 bg-canvas-surface px-3 py-1.5">
        <div className="flex items-center gap-1">
          {(Object.entries(VIEWPORT_SIZES) as [ViewportSize, typeof VIEWPORT_SIZES[ViewportSize]][]).map(([key, { label, icon: Icon }]) => (
            <button
              type="button"
              key={key}
              title={label}
              className={cn(
                "rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20",
                viewport === key && "bg-muted/20 text-foreground"
              )}
              onClick={() => setViewport(key)}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            onClick={handleRefresh}
            title="Refresh preview"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
          {hasPreview && (
            <button
              type="button"
              className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20"
              onClick={handleOpenExternal}
              title="Open in new tab"
            >
              <ExternalLinkIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-2">
        {hasPreview ? (
          <div
            className={cn(
              "h-full overflow-hidden rounded-lg border border-border/20 bg-white shadow-sm transition-all",
              viewport === "desktop" && "w-full"
            )}
            style={viewport !== "desktop" ? { width: VIEWPORT_SIZES[viewport].width, minHeight: "100%" } : undefined}
          >
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src={previewUrl || undefined}
              srcDoc={srcDoc}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center text-muted-foreground/40">
              <EyeIcon className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-sm font-medium">No preview available</p>
              <p className="mt-1 text-xs text-muted-foreground/30">
                Write an HTML file to see a live preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  onCloseTab,
  previewUrl,
  fileContents,
}: WebDevIDEViewProps) {
  const [activeTab, setActiveTab] = useState<IDETab>("code");

  // Auto-switch to preview when an HTML file is written
  const hasHtml = useMemo(() => {
    if (!fileContents) return false;
    return Object.keys(fileContents).some((k) => k.endsWith(".html"));
  }, [fileContents]);

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
            {tab.id === "preview" && hasHtml && (
              <span className="ml-1 size-1.5 rounded-full bg-green-400" />
            )}
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
            onCloseTab={onCloseTab}
          />
        )}
        {activeTab === "preview" && (
          <PreviewPanel
            previewUrl={previewUrl}
            fileContents={fileContents}
          />
        )}
        {activeTab === "database" && (
          <PlaceholderTab
            Icon={DatabaseIcon}
            label="Database Browser"
            color="text-yellow-400"
          />
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
