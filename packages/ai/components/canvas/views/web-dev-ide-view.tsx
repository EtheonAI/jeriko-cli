"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  MonitorPlayIcon,
  ChartPieIcon,
  EllipsisIcon,
  ShareIcon,
  XIcon,
  ChevronRightIcon,
  Loader2Icon,
  GlobeIcon,
  KeyIcon,
  BellIcon,
  CreditCardIcon,
  SearchIcon,
  LockIcon,
  BarChart3Icon,
  PencilIcon,
  ArrowUpIcon,
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
  /** Active sandbox ID for API calls */
  sandboxId?: string;
  /** Whether the agent is currently working */
  isWorking?: boolean;
  /** Whether the stream is active */
  isStreaming?: boolean;
  /** Close the IDE */
  onClose?: () => void;
}

type IDETab = "preview" | "code" | "dashboard" | "database" | "file" | "settings";

// ============================================================================
// Tab Configuration — matching Manus exactly
// ============================================================================

const IDE_TABS: {
  id: IDETab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "preview", label: "Preview", Icon: MonitorPlayIcon },
  { id: "code", label: "Code", Icon: CodeIcon },
  { id: "dashboard", label: "Dashboard", Icon: ChartPieIcon },
  { id: "database", label: "Database", Icon: DatabaseIcon },
  { id: "file", label: "File storage", Icon: FileStorageIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

// Custom File Storage icon matching Manus (folder + document)
function FileStorageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 6.53027H7.42871C7.54723 6.53027 7.65752 6.59326 7.71777 6.69531L8.41309 7.87207C8.54165 8.08982 8.77545 8.22355 9.02832 8.22363H13C13.4611 8.22363 13.8348 8.59758 13.835 9.05859V13.501C13.8348 13.962 13.461 14.3359 13 14.3359H3C2.53896 14.3359 2.16524 13.962 2.16504 13.501V7.36523C2.16504 6.90408 2.53884 6.53027 3 6.53027Z"
        stroke="currentColor"
        strokeWidth="1.33"
      />
      <path
        d="M3.73938 6.43381L3.73938 2.49023C3.73938 2.22502 3.84474 1.97066 4.03227 1.78313C4.21981 1.59559 4.47416 1.49023 4.73938 1.49023H10.0174L12.5174 3.99023V7.60089"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
      <path
        d="M9.42505 1.49023V3.44922C9.42505 3.709 9.52825 3.95813 9.71194 4.14182C9.89563 4.32551 10.1448 4.42871 10.4045 4.42871H12.3635"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

// GitHub icon for header (matching Manus)
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.99989 0.666748C3.95029 0.666748 0.666504 3.94996 0.666504 8.00014C0.666504 11.2402 2.76773 13.9891 5.68153 14.9588C6.04803 15.0267 6.1826 14.7997 6.1826 14.606C6.1826 14.4311 6.17573 13.8535 6.17263 13.2407C4.13248 13.6843 3.70199 12.3754 3.70199 12.3754C3.36838 11.5278 2.8877 11.3024 2.8877 11.3024C2.22237 10.8472 2.93789 10.8566 2.93789 10.8566C3.67426 10.9083 4.06201 11.6123 4.06201 11.6123C4.71611 12.7334 5.77761 12.4093 6.19607 12.2219C6.26189 11.748 6.45193 11.4244 6.66168 11.2413C5.03282 11.0559 3.32054 10.4271 3.32054 7.61714C3.32054 6.81649 3.607 6.16228 4.0761 5.64872C3.99996 5.46401 3.74897 4.71819 4.14714 3.70802C4.14714 3.70802 4.76297 3.51094 6.16438 4.45974C6.74933 4.29726 7.37668 4.2158 7.99989 4.21299C8.62311 4.2158 9.25097 4.29721 9.83701 4.45974C11.2367 3.51099 11.8517 3.70808 11.8517 3.70808C12.2508 4.71813 11.9997 5.46407 11.9236 5.64872C12.3938 6.16228 12.6783 6.81649 12.6783 7.61714C12.6783 10.4338 10.9627 11.054 9.32975 11.2355C9.59277 11.4631 9.82716 11.9094 9.82716 12.5936C9.82716 13.5747 9.81868 14.3644 9.81868 14.606C9.81868 14.8012 9.95068 15.0298 10.3224 14.9578C13.2346 13.9871 15.3332 11.2392 15.3332 8.0002C15.3332 3.94996 12.0498 0.666748 7.99989 0.666748Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Share/fork icon matching Manus
function ShareForkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.44678 1.92167C9.90519 1.76531 10.3033 1.98157 10.511 2.11796C10.7471 2.27305 11.0194 2.51595 11.2991 2.76322L14.614 5.69364L15.5522 6.51908C15.8505 6.78232 16.1272 7.03026 16.3608 7.25151C16.5947 7.47292 16.8095 7.68955 16.9702 7.88652C17.0503 7.98467 17.1323 8.0959 17.1973 8.21464C17.2549 8.32004 17.3415 8.5067 17.3416 8.73686C17.3416 8.96637 17.2552 9.15278 17.1973 9.25907C17.1323 9.37818 17.0504 9.4896 16.9702 9.58793C16.8093 9.78529 16.5947 10.0024 16.3608 10.2237C16.1272 10.4447 15.8499 10.6922 15.5515 10.9554L14.614 11.7801L11.2991 14.7105C11.0194 14.9578 10.7471 15.2007 10.511 15.3558C10.2894 15.5012 9.85081 15.7376 9.35376 15.5154V15.5147C8.8556 15.2917 8.74069 14.8068 8.70264 14.5442C8.66217 14.2649 8.66382 13.9004 8.66382 13.5284V12.3638C7.51116 12.4593 6.34925 12.771 5.3291 13.2654C4.16079 13.8317 3.22279 14.6151 2.67261 15.5396L2.56787 15.7264C2.40696 16.0312 2.05873 16.1871 1.72412 16.1043C1.38948 16.0214 1.1543 15.721 1.1543 15.3763C1.15435 11.4316 2.31556 8.84293 3.99463 7.24491C5.41986 5.88852 7.14748 5.31467 8.66382 5.17655V3.94535C8.66382 3.57338 8.66217 3.2088 8.70264 2.92948C8.74073 2.66678 8.85572 2.18107 9.35449 1.95829L9.44678 1.92167Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ViewportSize = "mobile" | "tablet" | "desktop";

const VIEWPORT_SIZES: Record<
  ViewportSize,
  { width: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  mobile: { width: "375px", label: "Mobile", icon: SmartphoneIcon },
  tablet: { width: "768px", label: "Tablet", icon: TabletIcon },
  desktop: { width: "100%", label: "Desktop", icon: MonitorIcon },
};

// ============================================================================
// Loading Overlay — Prevents interaction while building
// ============================================================================

function IDELoadingOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="size-12 rounded-full border-2 border-muted-foreground/20" />
          <div className="absolute inset-0 size-12 animate-spin rounded-full border-2 border-transparent border-t-blue-500" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Rubic is building your application...
        </p>
        <p className="text-xs text-muted-foreground/60">
          Please wait while the project is being set up
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// IDE Header — Manus-style pill tabs with action buttons
// ============================================================================

function IDEHeader({
  activeTab,
  onTabChange,
  onClose,
  sandboxId,
  isPublished,
}: {
  activeTab: IDETab;
  onTabChange: (tab: IDETab) => void;
  onClose?: () => void;
  sandboxId?: string;
  isPublished?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-0 pb-[10px] pt-[12px]">
      {/* Left: Tab buttons */}
      <div className="flex items-center gap-[4px]">
        {IDE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex h-[32px] items-center justify-center overflow-hidden rounded-[8px] border border-border/30 font-medium transition-[width,background-color,color,padding,gap] duration-100 ease-out",
                isActive
                  ? "gap-[6px] bg-background px-[12px] text-foreground"
                  : "w-[32px] gap-0 bg-transparent text-muted-foreground/60 hover:bg-muted/10"
              )}
            >
              <tab.Icon className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap text-[14px] font-medium tracking-[-0.091px] transition-opacity duration-100 ease-out",
                  isActive ? "opacity-100" : "hidden opacity-0"
                )}
                aria-hidden={!isActive}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-[4px] pr-[4px]">
        <div className="flex items-center gap-[8px]">
          {/* Ellipsis */}
          <button
            type="button"
            className="inline-flex size-[32px] items-center justify-center rounded-[8px] border border-border/30 bg-transparent text-muted-foreground hover:bg-muted/10"
          >
            <EllipsisIcon className="size-4" />
          </button>

          {/* GitHub */}
          <button
            type="button"
            className="inline-flex size-[32px] items-center justify-center rounded-[8px] border border-border/30 bg-transparent text-muted-foreground hover:bg-muted/10"
          >
            <GitHubIcon className="size-4" />
          </button>

          {/* Share */}
          <button
            type="button"
            className="inline-flex h-[32px] min-w-[64px] items-center justify-center gap-[4px] rounded-[8px] border border-border/30 bg-transparent px-[8px] text-[14px] font-medium text-foreground hover:bg-muted/10"
          >
            <ShareForkIcon className="size-[18px] text-muted-foreground" />
            Share
          </button>

          {/* Published / Publish */}
          <button
            type="button"
            disabled={!isPublished}
            className={cn(
              "inline-flex h-[32px] min-w-[64px] items-center justify-center gap-[4px] rounded-[8px] px-[8px] text-[14px] font-medium",
              isPublished
                ? "bg-[#1a1a19] text-white hover:bg-[#2a2a29]"
                : "cursor-not-allowed bg-[#1a1a19] text-white opacity-50"
            )}
          >
            <ShareIcon className="size-4" />
            {isPublished ? "Published" : "Publish"}
          </button>
        </div>

        {/* Close */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-[32px] cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted/10"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
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
  const [urlPath, setUrlPath] = useState("/");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const previewHtml = useMemo(() => {
    if (previewUrl) return null;
    if (!fileContents || Object.keys(fileContents).length === 0) return null;
    return buildPreviewHtml(fileContents);
  }, [previewUrl, fileContents]);

  const srcDoc = useMemo(() => {
    if (previewUrl) return undefined;
    return previewHtml ?? undefined;
  }, [previewUrl, previewHtml]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setIframeLoaded(false);
    setIframeError(false);
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
    <div className="flex h-full flex-col">
      {/* URL bar — matching Manus */}
      <div className="flex items-center gap-2 border-b border-border/10 px-3 py-2">
        <div className="flex items-center gap-1">
          {(Object.entries(VIEWPORT_SIZES) as [ViewportSize, (typeof VIEWPORT_SIZES)[ViewportSize]][]).map(
            ([key, { label, icon: Icon }]) => (
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
            )
          )}
        </div>

        {/* URL display */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/20 bg-muted/5 px-3 py-1">
          <span className="text-xs text-muted-foreground/60">/</span>
          <input
            type="text"
            value={urlPath}
            onChange={(e) => setUrlPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && previewUrl && iframeRef.current) {
                const base = new URL(previewUrl);
                base.pathname = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
                iframeRef.current.src = base.toString();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground outline-none"
            placeholder="/"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
          {/* Edit button */}
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground/50 transition-colors hover:bg-muted/20"
          >
            <PencilIcon className="size-3" />
            Edit
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
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/5 p-2">
        {hasPreview ? (
          <div
            className={cn(
              "relative h-full overflow-hidden rounded-lg border border-border/20 bg-white shadow-sm transition-all",
              viewport === "desktop" && "w-full"
            )}
            style={viewport !== "desktop" ? { width: VIEWPORT_SIZES[viewport].width, minHeight: "100%" } : undefined}
          >
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground/30" />
              </div>
            )}
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src={previewUrl || undefined}
              srcDoc={srcDoc}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
              onLoad={() => setIframeLoaded(true)}
              onError={() => {
                setIframeError(true);
                setIframeLoaded(true);
              }}
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="mb-4 rounded-xl bg-muted/10 p-6">
              <EyeIcon className="size-12 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/50">Failed to load preview.</p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-amber-700/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              Ask Rubic to fix
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Code Panel — code-server iframe + CodeView fallback
// ============================================================================

function CodePanel({
  sandboxId,
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  onSelectFile,
  onSelectTab,
  onCloseTab,
}: {
  sandboxId?: string;
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  onSelectFile?: (path: string) => void;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
}) {
  const [codeServerReady, setCodeServerReady] = useState(false);
  const [codeServerUrl, setCodeServerUrl] = useState<string | null>(null);
  const [authAttempted, setAuthAttempted] = useState(false);

  // Try to initialize code-server when sandboxId is available
  useEffect(() => {
    if (!sandboxId || authAttempted) return;
    setAuthAttempted(true);

    const initCodeServer = async () => {
      try {
        // Step 1: Pre-auth to start code-server and get token
        const preAuthResp = await fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "code-server-pre-auth" }),
        });

        if (!preAuthResp.ok) {
          console.warn("Code-server pre-auth failed, using fallback code view");
          return;
        }

        const preAuth = await preAuthResp.json();
        if (!preAuth.pre_auth_token || !preAuth.url) return;

        // Step 2: Auth with code-server
        const authResp = await fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sandboxId,
            action: "code-server-auth",
            pre_auth_token: preAuth.pre_auth_token,
          }),
        });

        if (authResp.ok) {
          // Use the URL from pre-auth response (includes correct E2B sandbox ID)
          const csUrl = `${preAuth.url}?folder=/home/ubuntu`;
          setCodeServerUrl(csUrl);
          setCodeServerReady(true);
        }
      } catch {
        console.warn("Code-server init failed, using fallback");
      }
    };

    initCodeServer();
  }, [sandboxId, authAttempted]);

  // Show code-server iframe when ready
  if (codeServerReady && codeServerUrl) {
    return (
      <div className="flex h-full flex-col">
        {/* Add file button bar matching Manus */}
        <div className="flex items-center justify-between border-b border-border/10 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground/50">Code Editor</span>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-blue-500 transition-colors hover:bg-blue-500/10"
          >
            Add file
          </button>
        </div>
        <iframe
          src={codeServerUrl}
          className="min-h-0 flex-1 border-0"
          title="Code Editor"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  // Fallback to read-only CodeView
  return (
    <CodeView
      fileTree={fileTree}
      fileTabs={fileTabs}
      activeFileContent={activeFileContent}
      activeFileLanguage={activeFileLanguage}
      onSelectFile={onSelectFile}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
    />
  );
}

// ============================================================================
// Dashboard Panel — Analytics matching Manus screenshot
// ============================================================================

function DashboardPanel({
  sandboxId,
  previewUrl,
}: {
  sandboxId?: string;
  previewUrl?: string;
}) {
  const projectName = useMemo(() => {
    if (!previewUrl) return "My Project";
    try {
      const hostname = new URL(previewUrl).hostname;
      return hostname.split("-")[0] || hostname.split(".")[0] || "My Project";
    } catch {
      return "My Project";
    }
  }, [previewUrl]);

  const projectUrl = useMemo(() => {
    if (!previewUrl) return "";
    try {
      return new URL(previewUrl).hostname;
    } catch {
      return previewUrl;
    }
  }, [previewUrl]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Project header */}
      <div className="border-b border-border/10 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">{projectName}</h2>
        {projectUrl && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">{projectUrl}</p>
        )}

        {/* Sub-tabs */}
        <div className="mt-3 flex items-center gap-4">
          {["Features", "Backend Server", "Database", "Manus Auth"].map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "text-xs transition-colors",
                i === 0 ? "font-medium text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {tab.replace("Manus", "Rubic")}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 border-b border-border/10 px-6 py-2">
        <button
          type="button"
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          Documentation
        </button>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Open website
          </a>
        )}
      </div>

      {/* Public status */}
      <div className="border-b border-border/10 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Public</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Your website is now publicly available and can be accessed by anyone.
        </p>
        <button
          type="button"
          className="mt-1 text-xs text-blue-500 hover:underline"
        >
          Manage access
        </button>
      </div>

      {/* Analytics */}
      <div className="flex-1 px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">Analytics</h3>

        {/* Filters */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border/20 px-3 py-1.5 text-xs text-muted-foreground"
          >
            Last 24 hours
            <ChevronRightIcon className="size-3 rotate-90" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border/20 px-3 py-1.5 text-xs text-muted-foreground"
          >
            Filters
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border/20 px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCwIcon className="size-3" />
            Refresh
          </button>
        </div>

        {/* Metric cards */}
        <div className="mt-4 grid grid-cols-5 gap-3">
          {[
            { label: "Page Views", value: "0", change: "—" },
            { label: "Visits", value: "0", change: "—" },
            { label: "Visitors", value: "0", change: "—" },
            { label: "Duration", value: "0s", change: "" },
            { label: "Bounce Rate", value: "0%", change: "" },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border/10 p-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {metric.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {metric.value}
              </p>
              {metric.change && (
                <p className="mt-0.5 text-[10px] text-green-500">
                  {metric.change}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-border/10 bg-muted/5">
          <div className="text-center">
            <BarChart3Icon className="mx-auto size-8 text-muted-foreground/20" />
            <p className="mt-2 text-xs text-muted-foreground/40">
              Analytics data will appear when your site gets traffic
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Database Panel — Table viewer matching Manus screenshot
// ============================================================================

interface TableColumn {
  name: string;
  type: string;
}

interface TableRow {
  [key: string]: unknown;
}

function DatabasePanel({ sandboxId }: { sandboxId?: string }) {
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"schema" | "auth">("schema");

  // Fetch table list
  const fetchTables = useCallback(async () => {
    if (!sandboxId) return;
    setIsLoadingTables(true);
    setError(null);

    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "database",
          operation: "query",
          query: "SHOW TABLES",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setError((errData as { error?: string }).error || "Failed to fetch tables");
        return;
      }

      const data = await resp.json();
      // Response: { success, operation, data: [...rows], rowCount }
      const rows = data.data ?? data.results ?? [];
      const tableList = rows.map((r: Record<string, string>) => Object.values(r)[0] as string);
      setTables(tableList);

      if (tableList.length > 0 && !activeTable) {
        setActiveTable(tableList[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tables");
    } finally {
      setIsLoadingTables(false);
    }
  }, [sandboxId, activeTable]);

  // Fetch table data when active table changes
  const fetchTableData = useCallback(async () => {
    if (!sandboxId || !activeTable) return;
    setIsLoadingData(true);

    try {
      // Fetch columns
      const colResp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "database",
          operation: "query",
          query: `DESCRIBE \`${activeTable}\``,
        }),
      });

      if (colResp.ok) {
        const colData = await colResp.json();
        const colRows = colData.data ?? colData.results ?? [];
        const cols = colRows.map((r: Record<string, string>) => ({
          name: r.Field || r.field || Object.values(r)[0],
          type: r.Type || r.type || Object.values(r)[1] || "unknown",
        }));
        setColumns(cols);
      }

      // Fetch row data
      const rowResp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "database",
          operation: "query",
          query: `SELECT * FROM \`${activeTable}\` LIMIT 50`,
        }),
      });

      if (rowResp.ok) {
        const rowData = await rowResp.json();
        setRows(rowData.data ?? rowData.results ?? []);
      }
    } catch {
      // Silently fail — data just won't show
    } finally {
      setIsLoadingData(false);
    }
  }, [sandboxId, activeTable]);

  // Load tables on mount
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Load table data when active table changes
  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const displayColumns = columns.length > 0 ? columns : rows.length > 0 ? Object.keys(rows[0]!).map((k) => ({ name: k, type: "unknown" })) : [];

  return (
    <div className="flex h-full">
      {/* Left sidebar — Table list */}
      <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-border/10">
        {isLoadingTables ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : tables.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/40">
            No tables found
          </div>
        ) : (
          tables.map((table) => (
            <button
              key={table}
              type="button"
              onClick={() => setActiveTable(table)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                activeTable === table
                  ? "bg-muted/20 font-medium text-foreground"
                  : "text-muted-foreground/70 hover:bg-muted/10"
              )}
            >
              <DatabaseIcon className="size-3 shrink-0 text-muted-foreground/40" />
              <span className="truncate">{table}</span>
            </button>
          ))
        )}
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — Schema/Auth tabs + actions */}
        <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSubTab("schema")}
              className={cn(
                "text-xs transition-colors",
                activeSubTab === "schema"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              Schema
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("auth")}
              className={cn(
                "text-xs transition-colors",
                activeSubTab === "auth"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              Rubic Auth
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border/20 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/10"
            >
              Columns
            </button>
            <button
              type="button"
              onClick={() => fetchTableData()}
              className="flex items-center gap-1 rounded-md border border-border/20 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/10"
            >
              <RefreshCwIcon className="size-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Data grid */}
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoadingData ? (
            <div className="flex h-full items-center justify-center">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ) : displayColumns.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <DatabaseIcon className="mx-auto mb-2 size-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/40">Select a table to view data</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/10 bg-muted/5">
                  {displayColumns.map((col) => (
                    <th
                      key={col.name}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground/60"
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/5 transition-colors hover:bg-muted/5"
                  >
                    {displayColumns.map((col) => (
                      <td
                        key={col.name}
                        className="max-w-[200px] truncate whitespace-nowrap px-3 py-2 text-muted-foreground/80"
                      >
                        {row[col.name] != null ? String(row[col.name]) : "NULL"}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={displayColumns.length}
                      className="py-8 text-center text-muted-foreground/40"
                    >
                      No rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer — row count + pagination */}
        <div className="flex items-center justify-between border-t border-border/10 px-3 py-2">
          <span className="text-[10px] text-muted-foreground/40">
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/40">Rows per page</span>
            <select className="rounded border border-border/10 bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground/60">
              <option>50</option>
              <option>100</option>
              <option>200</option>
            </select>
          </div>
          {/* Settings button (matching Manus) */}
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/50 hover:bg-muted/10"
          >
            <SettingsIcon className="size-3" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File Storage Panel — matching Manus screenshot
// ============================================================================

interface StorageFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  type: "file" | "directory";
}

function FileStoragePanel({ sandboxId }: { sandboxId?: string }) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<"name" | "lastModified" | "size">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchFiles = useCallback(async () => {
    if (!sandboxId) return;
    setIsLoading(true);

    try {
      // List user-uploaded files and project output files (Manus pattern)
      // Check ~/upload/ first (user-uploaded files), then project public/ dir
      const allFiles: StorageFile[] = [];
      const dirsToScan = ["/home/ubuntu/upload", "/home/ubuntu/screenshots"];

      for (const dir of dirsToScan) {
        try {
          const resp = await fetch("/api/ide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId, action: "file-list", path: dir }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const fileList = (data.files ?? [])
              .filter((f: { name: string; type?: string }) => f.type !== "directory")
              .map((f: { name: string; path?: string; size?: number; lastModified?: string; type?: string }) => ({
                name: f.name,
                path: f.path || `${dir}/${f.name}`,
                size: f.size || 0,
                lastModified: f.lastModified || new Date().toISOString(),
                type: f.type || "file",
              }));
            allFiles.push(...fileList);
          }
        } catch {
          // Directory may not exist
        }
      }

      setFiles(allFiles);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [files, sortField, sortDir]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header text */}
      <div className="flex items-center justify-between border-b border-border/10 px-6 py-3">
        <p className="text-xs text-muted-foreground/60">
          Files created or uploaded by website users will be displayed here.
        </p>
        <button
          type="button"
          className="text-xs text-blue-500 hover:underline"
        >
          Learn more
        </button>
      </div>

      {/* All files header */}
      <div className="px-6 py-3">
        <span className="text-xs font-medium text-foreground">All files</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_180px_100px] border-b border-border/10 px-6 py-2">
        <button
          type="button"
          onClick={() => toggleSort("name")}
          className="flex items-center gap-1 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground"
        >
          Name
          {sortField === "name" && (
            <ArrowUpIcon className={cn("size-3", sortDir === "desc" && "rotate-180")} />
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleSort("lastModified")}
          className="flex items-center gap-1 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground"
        >
          Last modified time
          {sortField === "lastModified" && (
            <ArrowUpIcon className={cn("size-3", sortDir === "desc" && "rotate-180")} />
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleSort("size")}
          className="flex items-center gap-1 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground"
        >
          Size
          {sortField === "size" && (
            <ArrowUpIcon className={cn("size-3", sortDir === "desc" && "rotate-180")} />
          )}
        </button>
      </div>

      {/* File list or empty state */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            {/* "No data" icon matching Manus — document + magnifying glass */}
            <div className="mb-3 text-muted-foreground/20">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="16" y="8" width="32" height="40" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M24 20H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 28H36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 36H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="44" cy="48" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="M50 54L56 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground/40">No data</p>
          </div>
        ) : (
          sortedFiles.map((file) => (
            <div
              key={file.path}
              className="grid grid-cols-[1fr_180px_100px] items-center border-b border-border/5 px-6 py-2.5 transition-colors hover:bg-muted/5"
            >
              <div className="flex items-center gap-2 text-xs text-foreground">
                <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground/40" />
                <span className="truncate">{file.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50">
                {new Date(file.lastModified).toLocaleDateString()}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {formatSize(file.size)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Settings Panel — matching Manus screenshot exactly
// ============================================================================

type SettingsCategory =
  | "general"
  | "domains"
  | "notifications"
  | "payment"
  | "seo"
  | "secrets"
  | "github"
  | "usage";

const SETTINGS_CATEGORIES: {
  id: SettingsCategory;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "general", label: "General", Icon: SettingsIcon },
  { id: "domains", label: "Domains", Icon: GlobeIcon },
  { id: "notifications", label: "Notifications", Icon: BellIcon },
  { id: "payment", label: "Payment", Icon: CreditCardIcon },
  { id: "seo", label: "SEO", Icon: SearchIcon },
  { id: "secrets", label: "Secrets", Icon: LockIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
  { id: "usage", label: "Usage", Icon: BarChart3Icon },
];

function SettingsPanel({
  sandboxId,
  previewUrl,
}: {
  sandboxId?: string;
  previewUrl?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [projectName, setProjectName] = useState("My Project");
  const [hideRubicBadge, setHideRubicBadge] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [customDomain, setCustomDomain] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");

  const projectUrl = useMemo(() => {
    if (!previewUrl) return "";
    try {
      return new URL(previewUrl).hostname;
    } catch {
      return "";
    }
  }, [previewUrl]);

  const renderContent = () => {
    switch (activeCategory) {
      case "general":
        return (
          <div className="space-y-6">
            {/* Project name */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {projectName}
                </h3>
                <button
                  type="button"
                  className="text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <PencilIcon className="size-3" />
                </button>
              </div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-xs text-blue-500 hover:underline"
                >
                  Open website
                </a>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-4 border-b border-border/10 pb-2">
              {["Features", "Backend Server", "Database", "Rubic Auth"].map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "text-xs transition-colors",
                    i === 0 ? "font-medium text-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Publish & Access */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground">
                Publish & Access
              </h4>

              {/* Domains */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Domains</span>
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Customize domain
                  </button>
                </div>
                <div className="mt-1.5 rounded-md border border-border/20 bg-muted/5 px-3 py-2">
                  <span className="text-xs text-muted-foreground/60">
                    {projectUrl || "No URL assigned yet"}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div>
                <span className="text-xs font-medium text-foreground">Status</span>
                <div className="mt-1 flex items-center gap-2">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span className="text-xs text-foreground">Live</span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    Unpublish
                  </button>
                </div>
              </div>

              {/* Public/Private */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Public</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  Your website is now publicly available and can be accessed by anyone.
                </p>
                <button
                  type="button"
                  className="mt-1 text-xs text-blue-500 hover:underline"
                >
                  Manage access
                </button>
              </div>
            </div>

            {/* Advanced */}
            <div className="space-y-2 border-t border-border/10 pt-4">
              <h4 className="text-xs font-semibold text-foreground">Advanced</h4>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hideRubicBadge}
                  onChange={(e) => setHideRubicBadge(e.target.checked)}
                  className="rounded"
                />
                Hide Rubic badge
              </label>
              <p className="text-[10px] text-muted-foreground/40">
                Remove &apos;Rubic&apos; badge from your website.
              </p>
            </div>
          </div>
        );

      case "domains":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Custom Domains</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Domain</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="example.com"
                  className="flex-1 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
                />
                <button
                  type="button"
                  className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  Add
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40">
              Point your domain&apos;s CNAME record to your project URL.
            </p>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="space-y-3">
              {["Email notifications", "Push notifications", "Slack integration"].map((item) => (
                <label key={item} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item}</span>
                  <input type="checkbox" className="rounded" />
                </label>
              ))}
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Payment</h3>
            <p className="text-xs text-muted-foreground/60">
              Connect a payment provider to accept payments on your website.
            </p>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-border/20 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/10"
            >
              <CreditCardIcon className="size-4" />
              Connect Stripe
            </button>
          </div>
        );

      case "seo":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">SEO Settings</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Page Title</label>
              <input
                type="text"
                defaultValue={projectName}
                className="mt-1 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meta Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none"
                rows={3}
                placeholder="Describe your website..."
              />
            </div>
          </div>
        );

      case "secrets":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Environment Secrets</h3>
            <p className="text-xs text-muted-foreground/60">
              Add environment variables that will be available to your application at runtime.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                placeholder="KEY"
                className="w-32 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
              />
              <input
                type="password"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                placeholder="Value"
                className="flex-1 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSecretKey && newSecretValue) {
                    setSecrets((prev) => ({ ...prev, [newSecretKey]: newSecretValue }));
                    setNewSecretKey("");
                    setNewSecretValue("");
                  }
                }}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
              >
                Add
              </button>
            </div>
            {Object.entries(secrets).length > 0 && (
              <div className="space-y-1">
                {Object.entries(secrets).map(([key]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border/10 px-3 py-2"
                  >
                    <span className="text-xs font-mono text-foreground">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/40">********</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...secrets };
                          delete next[key];
                          setSecrets(next);
                        }}
                        className="text-xs text-red-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "github":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">GitHub Integration</h3>
            <p className="text-xs text-muted-foreground/60">
              Push your project to GitHub for version control and collaboration.
            </p>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-border/20 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/10"
            >
              <GitHubIcon className="size-4" />
              Connect GitHub
            </button>
            <div className="space-y-2 border-t border-border/10 pt-3">
              <button
                type="button"
                className="w-full rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90"
              >
                Push to GitHub
              </button>
            </div>
          </div>
        );

      case "usage":
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Usage</h3>
            <div className="space-y-3">
              {[
                { label: "Storage", used: "12 MB", total: "1 GB" },
                { label: "Bandwidth", used: "45 MB", total: "10 GB" },
                { label: "Build minutes", used: "3 min", total: "100 min" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-muted-foreground/50">
                      {item.used} / {item.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted/20">
                    <div className="h-full w-[5%] rounded-full bg-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-44 flex-shrink-0 overflow-y-auto border-r border-border/10">
        {SETTINGS_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors",
              activeCategory === cat.id
                ? "bg-muted/20 font-medium text-foreground"
                : "text-muted-foreground/60 hover:bg-muted/10 hover:text-muted-foreground"
            )}
          >
            <cat.Icon className="size-3.5 shrink-0" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
        {/* Documentation link (top-right like Manus) */}
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="text-xs text-blue-500 hover:underline"
          >
            Documentation
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

// ============================================================================
// Preview HTML Builder
// ============================================================================

function buildPreviewHtml(fileContents: Record<string, string>): string | null {
  const htmlFile = findFile(fileContents, ["index.html", "main.html", "page.html"]);
  if (htmlFile) {
    let html = htmlFile;
    const cssFiles = Object.entries(fileContents).filter(([k]) => k.endsWith(".css"));
    if (cssFiles.length > 0) {
      const cssBlock = cssFiles.map(([, css]) => `<style>${css}</style>`).join("\n");
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${cssBlock}\n</head>`);
      } else if (html.includes("<body")) {
        html = html.replace("<body", `${cssBlock}\n<body`);
      } else {
        html = cssBlock + "\n" + html;
      }
    }
    const jsFiles = Object.entries(fileContents).filter(([k]) => k.endsWith(".js") || k.endsWith(".mjs"));
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
// Main Component
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
  sandboxId,
  isWorking,
  isStreaming,
  onClose,
}: WebDevIDEViewProps) {
  const [activeTab, setActiveTab] = useState<IDETab>("preview");
  const [mountedTabs, setMountedTabs] = useState<Set<IDETab>>(new Set(["preview"]));

  // Track which tabs have been mounted (lazy rendering like Manus)
  const handleTabChange = (tab: IDETab) => {
    setActiveTab(tab);
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  // Auto-switch to preview when preview URL becomes available
  useEffect(() => {
    if (previewUrl && activeTab !== "preview") {
      // Only auto-switch if we're on a tab that doesn't have content yet
      if (activeTab === "code" && !fileTree?.length && !activeFileContent) {
        setActiveTab("preview");
      }
    }
  }, [previewUrl]);

  // Show loading overlay when agent is actively working and no preview is ready
  const showLoadingOverlay = isWorking && isStreaming && !previewUrl;

  return (
    <div className="relative flex h-full flex-col">
      {/* Loading overlay */}
      {showLoadingOverlay && <IDELoadingOverlay />}

      {/* IDE Header — Manus-style */}
      <div className="border-b border-border/10 px-4">
        <IDEHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onClose={onClose}
          sandboxId={sandboxId}
          isPublished={!!previewUrl}
        />
      </div>

      {/* Tab Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Preview — always mounted */}
        <div className={cn("h-full", activeTab !== "preview" && "hidden")}>
          <PreviewPanel previewUrl={previewUrl} fileContents={fileContents} />
        </div>

        {/* Code — lazy mounted */}
        {mountedTabs.has("code") && (
          <div className={cn("h-full", activeTab !== "code" && "hidden")}>
            <CodePanel
              sandboxId={sandboxId}
              fileTree={fileTree}
              fileTabs={fileTabs}
              activeFileContent={activeFileContent}
              activeFileLanguage={activeFileLanguage}
              onSelectFile={onSelectFile}
              onSelectTab={onSelectTab}
              onCloseTab={onCloseTab}
            />
          </div>
        )}

        {/* Dashboard — lazy mounted */}
        {mountedTabs.has("dashboard") && (
          <div className={cn("h-full", activeTab !== "dashboard" && "hidden")}>
            <DashboardPanel sandboxId={sandboxId} previewUrl={previewUrl} />
          </div>
        )}

        {/* Database — lazy mounted */}
        {mountedTabs.has("database") && (
          <div className={cn("h-full", activeTab !== "database" && "hidden")}>
            <DatabasePanel sandboxId={sandboxId} />
          </div>
        )}

        {/* File Storage — lazy mounted */}
        {mountedTabs.has("file") && (
          <div className={cn("h-full", activeTab !== "file" && "hidden")}>
            <FileStoragePanel sandboxId={sandboxId} />
          </div>
        )}

        {/* Settings — lazy mounted */}
        {mountedTabs.has("settings") && (
          <div className={cn("h-full", activeTab !== "settings" && "hidden")}>
            <SettingsPanel sandboxId={sandboxId} previewUrl={previewUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
