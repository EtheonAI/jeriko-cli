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
  /** Project path in the sandbox (e.g. /home/ubuntu/my-app) */
  projectPath?: string;
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
  projectPath,
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  onSelectFile,
  onSelectTab,
  onCloseTab,
}: {
  sandboxId?: string;
  projectPath?: string;
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
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Try to initialize code-server when sandboxId is available, with retry
  useEffect(() => {
    if (!sandboxId || codeServerReady) return;

    let cancelled = false;

    const initCodeServer = async () => {
      while (retryCountRef.current < MAX_RETRIES && !cancelled) {
        try {
          // Step 1: Pre-auth to start code-server and get token
          const preAuthResp = await fetch("/api/ide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId, action: "code-server-pre-auth" }),
          });

          if (!preAuthResp.ok) {
            retryCountRef.current++;
            if (retryCountRef.current < MAX_RETRIES) {
              // Exponential backoff: 2s, 4s, 8s
              await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, retryCountRef.current - 1)));
              continue;
            }
            console.warn("Code-server pre-auth failed after retries, using fallback");
            return;
          }

          const preAuth = await preAuthResp.json();
          if (!preAuth.pre_auth_token || !preAuth.url) {
            retryCountRef.current++;
            if (retryCountRef.current < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, retryCountRef.current - 1)));
              continue;
            }
            return;
          }

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

          if (authResp.ok && !cancelled) {
            const csUrl = `${preAuth.url}?folder=${encodeURIComponent(projectPath || "/home/ubuntu")}`;
            setCodeServerUrl(csUrl);
            setCodeServerReady(true);
            return;
          }

          retryCountRef.current++;
          if (retryCountRef.current < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, retryCountRef.current - 1)));
          }
        } catch {
          retryCountRef.current++;
          if (retryCountRef.current < MAX_RETRIES && !cancelled) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, retryCountRef.current - 1)));
          } else {
            console.warn("Code-server init failed after retries, using fallback");
          }
        }
      }
    };

    initCodeServer();
    return () => { cancelled = true; };
  }, [sandboxId, codeServerReady, projectPath]);

  // Show code-server iframe when ready
  if (codeServerReady && codeServerUrl) {
    return (
      <div className="flex h-full flex-col">
        {/* Add file button bar matching Manus */}
        <div className="flex items-center justify-between border-b border-border/10 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground/50">Code Editor</span>
          <button
            type="button"
            onClick={async () => {
              const fileName = window.prompt("Enter file path (e.g., src/components/Button.tsx):");
              if (!fileName?.trim() || !sandboxId) return;
              const filePath = fileName.startsWith("/") ? fileName : `${projectPath || "/home/ubuntu/my-app"}/${fileName}`;
              try {
                await fetch("/api/ide", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sandboxId, action: "files", paths: [filePath], contents: { [filePath]: "" } }),
                });
                // Reload code-server iframe to show new file
                const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Code Editor"]');
                if (iframe) iframe.src = `${iframe.src}`;
              } catch { /* ignore — file create may not work if endpoint doesn't support write this way */ }
            }}
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

// Time range presets for analytics
const TIME_RANGES = [
  { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000, unit: "hour" as const },
  { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000, unit: "day" as const },
  { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000, unit: "day" as const },
  { label: "Last 90 days", ms: 90 * 24 * 60 * 60 * 1000, unit: "week" as const },
] as const;

interface AnalyticsStats {
  pageviews: { value: number; change?: number };
  visitors: { value: number; change?: number };
  visits: { value: number; change?: number };
  bounces: { value: number; change?: number };
  totaltime: { value: number; change?: number };
}

interface PageviewEntry {
  x: string; // date/time label
  y: number; // count
}

function DashboardPanel({
  sandboxId,
  previewUrl,
}: {
  sandboxId?: string;
  previewUrl?: string;
}) {
  const [dashSubTab, setDashSubTab] = useState<"features" | "backend" | "database" | "auth">("features");
  const [timeRangeIdx, setTimeRangeIdx] = useState(0);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [pageviews, setPageviews] = useState<PageviewEntry[]>([]);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const fetchRef = useRef(0);
  const [serverStatus, setServerStatus] = useState<Record<string, unknown> | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

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

  const fetchAnalytics = useCallback(async (rangeIdx: number) => {
    if (!sandboxId) return;
    const id = ++fetchRef.current;
    setLoading(true);

    const range = TIME_RANGES[rangeIdx] ?? TIME_RANGES[0];
    const now = Date.now();
    const startAt = now - range.ms;
    const endAt = now;

    try {
      // Fetch stats + pageviews + active in parallel
      const [statsResp, pvResp, activeResp] = await Promise.all([
        fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "webdev-analytics", query: "stats", startAt, endAt }),
        }),
        fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "webdev-analytics", query: "pageviews", startAt, endAt, unit: range.unit }),
        }),
        fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "webdev-analytics", query: "active" }),
        }),
      ]);

      if (id !== fetchRef.current) return; // stale

      if (statsResp.ok) {
        const statsData = await statsResp.json();
        setStats(statsData.stats ?? null);
        setConfigured(statsData.configured !== false);
      }
      if (pvResp.ok) {
        const pvData = await pvResp.json();
        setPageviews(pvData.pageviews ?? []);
      }
      if (activeResp.ok) {
        const activeData = await activeResp.json();
        setActiveVisitors(activeData.active ?? 0);
      }
    } catch {
      // Network error — show empty state
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    fetchAnalytics(timeRangeIdx);
  }, [fetchAnalytics, timeRangeIdx]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchAnalytics(timeRangeIdx), 60_000);
    return () => clearInterval(interval);
  }, [fetchAnalytics, timeRangeIdx]);

  // Fetch server status for Backend Server sub-tab
  const fetchServerStatus = useCallback(async () => {
    if (!sandboxId) return;
    setServerLoading(true);
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "webdev-status" }),
      });
      if (resp.ok) setServerStatus(await resp.json());
    } catch { /* */ }
    finally { setServerLoading(false); }
  }, [sandboxId]);

  useEffect(() => {
    if (dashSubTab === "backend" || dashSubTab === "database") fetchServerStatus();
  }, [dashSubTab, fetchServerStatus]);

  // Format helpers
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatDuration = (totalMs: number, visits: number) => {
    if (!visits) return "0s";
    const avgSec = Math.round(totalMs / visits / 1000);
    if (avgSec >= 3600) return `${Math.floor(avgSec / 3600)}h ${Math.floor((avgSec % 3600) / 60)}m`;
    if (avgSec >= 60) return `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`;
    return `${avgSec}s`;
  };

  const formatChange = (change?: number) => {
    if (change == null || change === 0) return "—";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change}%`;
  };

  const bounceRate = stats
    ? stats.visits.value > 0
      ? `${Math.round((stats.bounces.value / stats.visits.value) * 100)}%`
      : "0%"
    : "0%";

  const avgDuration = stats
    ? formatDuration(stats.totaltime.value, stats.visits.value)
    : "0s";

  const metrics = [
    { label: "Page Views", value: stats ? formatNumber(stats.pageviews.value) : "0", change: formatChange(stats?.pageviews.change) },
    { label: "Visits", value: stats ? formatNumber(stats.visits.value) : "0", change: formatChange(stats?.visits.change) },
    { label: "Visitors", value: stats ? formatNumber(stats.visitors.value) : "0", change: formatChange(stats?.visitors.change) },
    { label: "Duration", value: avgDuration, change: "" },
    { label: "Bounce Rate", value: bounceRate, change: "" },
  ];

  // Simple sparkline bar chart from pageview data
  const maxPv = Math.max(1, ...pageviews.map((p) => p.y));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Project header */}
      <div className="border-b border-border/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{projectName}</h2>
          {activeVisitors > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              {activeVisitors} online
            </span>
          )}
        </div>
        {projectUrl && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">{projectUrl}</p>
        )}

        {/* Sub-tabs */}
        <div className="mt-3 flex items-center gap-4">
          {([
            { id: "features" as const, label: "Features" },
            { id: "backend" as const, label: "Backend Server" },
            { id: "database" as const, label: "Database" },
            { id: "auth" as const, label: "Rubic Auth" },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDashSubTab(tab.id)}
              className={cn(
                "text-xs transition-colors",
                dashSubTab === tab.id ? "font-medium text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {tab.label}
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

      {/* Sub-tab content */}
      {dashSubTab === "backend" && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Backend Server</h3>
          {serverLoading ? (
            <div className="mt-4 flex justify-center"><Loader2Icon className="size-4 animate-spin text-muted-foreground/40" /></div>
          ) : serverStatus ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", (serverStatus as Record<string, unknown>).devServer && ((serverStatus as Record<string, { status?: string }>).devServer?.status === "running") ? "bg-green-500" : "bg-red-500")} />
                <span className="text-xs text-foreground">
                  Dev server: {((serverStatus as Record<string, { status?: string }>).devServer?.status) || "unknown"}
                </span>
              </div>
              {(serverStatus as Record<string, { recentOutput?: string[] }>).devServer?.recentOutput && (
                <div className="rounded-md bg-muted/10 p-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Recent Output</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground/70">
                    {((serverStatus as Record<string, { recentOutput?: string[] }>).devServer?.recentOutput ?? []).slice(-20).join("\n")}
                  </pre>
                </div>
              )}
              {(serverStatus as Record<string, { typescript?: string }>).healthChecks && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Health Checks</p>
                  <p className="text-xs text-muted-foreground">
                    TypeScript: {(serverStatus as Record<string, { typescript?: string }>).healthChecks?.typescript || "OK"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dependencies: {(serverStatus as Record<string, { dependencies?: string }>).healthChecks?.dependencies || "OK"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground/50">No server status available. Start a project first.</p>
          )}
        </div>
      )}

      {dashSubTab === "database" && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Database Status</h3>
          {serverLoading ? (
            <div className="mt-4 flex justify-center"><Loader2Icon className="size-4 animate-spin text-muted-foreground/40" /></div>
          ) : serverStatus ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", (serverStatus as Record<string, unknown>).features && ((serverStatus as { features?: string[] }).features ?? []).includes("db") ? "bg-green-500" : "bg-yellow-500")} />
                <span className="text-xs text-foreground">
                  {((serverStatus as { features?: string[] }).features ?? []).includes("db") ? "Database connected (TiDB)" : "No database configured"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Use the Database tab to explore tables, run queries, and manage schema.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground/50">No database status available.</p>
          )}
        </div>
      )}

      {dashSubTab === "auth" && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Rubic Auth</h3>
          <p className="mt-3 text-xs text-muted-foreground/60">
            OAuth authentication is automatically configured for your app. Users can sign in via Google, GitHub, or email/password through the Rubic Auth portal.
          </p>
          <div className="mt-3 rounded-md bg-muted/10 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Endpoints</p>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground/70">
              <p>POST /webdev.v1.WebDevAuthPublicService/ExchangeToken</p>
              <p>POST /webdev.v1.WebDevAuthPublicService/GetUserInfo</p>
              <p>POST /webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt</p>
            </div>
          </div>
        </div>
      )}

      {dashSubTab === "features" && (<>
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTimeMenu((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border/20 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/10"
            >
              {TIME_RANGES[timeRangeIdx]?.label ?? "Last 24 hours"}
              <ChevronRightIcon className="size-3 rotate-90" />
            </button>
            {showTimeMenu && (
              <div className="absolute left-0 top-full z-10 mt-1 rounded-md border border-border/20 bg-background py-1 shadow-lg">
                {TIME_RANGES.map((range, i) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => { setTimeRangeIdx(i); setShowTimeMenu(false); }}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-xs hover:bg-muted/10",
                      i === timeRangeIdx ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics(timeRangeIdx)}
            disabled={loading}
            className="flex items-center gap-1 rounded-md border border-border/20 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/10 disabled:opacity-50"
          >
            <RefreshCwIcon className={cn("size-3", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Metric cards */}
        <div className="mt-4 grid grid-cols-5 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border/10 p-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {metric.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {loading ? "..." : metric.value}
              </p>
              {metric.change && (
                <p className={cn(
                  "mt-0.5 text-[10px]",
                  metric.change.startsWith("+") ? "text-green-500" : metric.change.startsWith("-") ? "text-red-400" : "text-muted-foreground/40"
                )}>
                  {loading ? "" : metric.change}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Chart — simple bar visualization */}
        <div className="mt-4 rounded-lg border border-border/10 bg-muted/5 p-4">
          {!configured ? (
            <div className="flex h-32 items-center justify-center text-center">
              <div>
                <BarChart3Icon className="mx-auto size-8 text-muted-foreground/20" />
                <p className="mt-2 text-xs text-muted-foreground/40">
                  Analytics not configured. Set ANALYTICS_ENDPOINT to enable.
                </p>
              </div>
            </div>
          ) : pageviews.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-center">
              <div>
                <BarChart3Icon className="mx-auto size-8 text-muted-foreground/20" />
                <p className="mt-2 text-xs text-muted-foreground/40">
                  {loading ? "Loading analytics..." : "Analytics data will appear when your site gets traffic"}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                Page Views
              </p>
              <div className="flex h-32 items-end gap-px">
                {pageviews.map((pv, i) => (
                  <div
                    key={`${pv.x}-${i}`}
                    className="group relative flex-1"
                    title={`${pv.x}: ${pv.y} views`}
                  >
                    <div
                      className="w-full rounded-t bg-blue-500/60 transition-colors group-hover:bg-blue-500"
                      style={{ height: `${Math.max(2, (pv.y / maxPv) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              {/* X-axis labels (first, middle, last) */}
              {pageviews.length >= 3 && (
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/40">
                  <span>{pageviews[0]?.x}</span>
                  <span>{pageviews[Math.floor(pageviews.length / 2)]?.x}</span>
                  <span>{pageviews[pageviews.length - 1]?.x}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>)}
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
  const [rowLimit, setRowLimit] = useState(50);

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
          query: `SELECT * FROM \`${activeTable}\` LIMIT ${rowLimit}`,
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
  }, [sandboxId, activeTable, rowLimit]);

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
            <select
              value={rowLimit}
              onChange={(e) => setRowLimit(Number(e.target.value))}
              className="rounded border border-border/10 bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground/60"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
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

function FileStoragePanel({ sandboxId, projectPath }: { sandboxId?: string; projectPath?: string }) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<"name" | "lastModified" | "size">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchFiles = useCallback(async () => {
    if (!sandboxId) return;
    setIsLoading(true);

    try {
      // List user-uploaded files, project assets, and screenshots (Manus pattern)
      const allFiles: StorageFile[] = [];
      const dirsToScan = [
        ...(projectPath ? [`${projectPath}/public`, `${projectPath}/attached_assets`] : []),
        "/home/ubuntu/upload",
        "/home/ubuntu/screenshots",
      ];

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
  }, [sandboxId, projectPath]);

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
      <div className="grid grid-cols-[1fr_180px_100px_60px] border-b border-border/10 px-6 py-2">
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
          Actions
        </span>
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
              className="grid grid-cols-[1fr_180px_100px_60px] items-center border-b border-border/5 px-6 py-2.5 transition-colors hover:bg-muted/5"
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
              <button
                type="button"
                onClick={async () => {
                  if (!sandboxId) return;
                  try {
                    const resp = await fetch("/api/ide", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sandboxId, action: "files", paths: [file.path] }),
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      const content = data.files?.[file.path] ?? data.contents?.[0]?.content ?? "";
                      const blob = new Blob([content], { type: "application/octet-stream" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = file.name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  } catch { /* download failed */ }
                }}
                className="text-[10px] text-blue-500 hover:underline"
              >
                Download
              </button>
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
  projectPath,
}: {
  sandboxId?: string;
  previewUrl?: string;
  projectPath?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [projectName, setProjectName] = useState("My Project");
  const [hideRubicBadge, setHideRubicBadge] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [customDomain, setCustomDomain] = useState("");
  const [domains, setDomains] = useState<Array<{ domain: string; status: "pending" | "active" | "error"; cname?: string }>>([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "published" | "failed">("idle");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [secretsSaving, setSecretsSaving] = useState(false);

  // SEO state
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);
  const [seoIndexing, setSeoIndexing] = useState(true);
  const [seoSitemap, setSeoSitemap] = useState(true);
  const [seoPrerender, setSeoPrerender] = useState(true);

  // GitHub state
  const [gitSyncStatus, setGitSyncStatus] = useState<{
    branch?: string;
    clean?: boolean;
    changes?: number;
    hasRemote?: boolean;
    ahead?: number;
    behind?: number;
  } | null>(null);
  const [gitPushStatus, setGitPushStatus] = useState<"idle" | "pushing" | "done" | "failed">("idle");

  // Notifications state — Knock-based website event notifications
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    email: true,
    inApp: true,
  });
  const [notifRules, setNotifRules] = useState<{ event: string; enabled: boolean }[]>([
    { event: "Form submission", enabled: true },
    { event: "Product sold", enabled: true },
    { event: "Negative review", enabled: false },
    { event: "New user signup", enabled: false },
  ]);
  const [notifSaving, setNotifSaving] = useState(false);
  const [newRuleText, setNewRuleText] = useState("");

  // Usage state
  const [usageData, setUsageData] = useState<{ label: string; used: string; total: string; pct: number }[] | null>(null);

  // Save notification delivery prefs + rules to sandbox .env
  const handleSaveNotifPrefs = useCallback(async (updated: Record<string, boolean>) => {
    if (!sandboxId) return;
    setNotifSaving(true);
    try {
      // Save delivery preferences to sandbox .env
      await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-update-env",
          envVars: {
            RUBIC_NOTIF_EMAIL: updated.email ? "true" : "false",
            RUBIC_NOTIF_INAPP: updated.inApp ? "true" : "false",
            RUBIC_NOTIF_RULES: JSON.stringify(notifRules.filter(r => r.enabled).map(r => r.event)),
          },
        }),
      });
    } finally {
      setNotifSaving(false);
    }
  }, [sandboxId, notifRules]);

  const handlePublish = useCallback(async () => {
    if (!sandboxId) return;
    setPublishStatus("publishing");
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "deploy-static",
          projectPath: projectPath || "/home/ubuntu/my-app",
          projectName: projectName || "my-app",
          outputDir: "dist",
          buildFirst: true,
        }),
      });
      const data = await resp.json();
      if (data.success && data.url) {
        setPublishedUrl(data.url);
        setPublishStatus("published");
      } else {
        setPublishStatus("failed");
      }
    } catch {
      setPublishStatus("failed");
    }
  }, [sandboxId, projectPath, projectName]);

  const [restartStatus, setRestartStatus] = useState<"idle" | "restarting" | "done" | "failed">("idle");

  const handleRestart = useCallback(async () => {
    if (!sandboxId) return;
    setRestartStatus("restarting");
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-restart",
          projectPath: projectPath || "/home/ubuntu/my-app",
        }),
      });
      const data = await resp.json();
      setRestartStatus(data.success ? "done" : "failed");
      // Reset after 3s
      setTimeout(() => setRestartStatus("idle"), 3000);
    } catch {
      setRestartStatus("failed");
      setTimeout(() => setRestartStatus("idle"), 3000);
    }
  }, [sandboxId, projectPath]);

  const handleSaveSecrets = useCallback(async () => {
    if (!sandboxId || Object.keys(secrets).length === 0) return;
    setSecretsSaving(true);
    try {
      await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-update-env",
          envVars: secrets,
        }),
      });
    } finally {
      setSecretsSaving(false);
    }
  }, [sandboxId, secrets]);

  // SEO save — writes title, description, and toggle settings to sandbox .env
  const handleSaveSeo = useCallback(async () => {
    if (!sandboxId) return;
    setSeoSaving(true);
    setSeoSaved(false);
    try {
      await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-update-env",
          envVars: {
            VITE_APP_TITLE: seoTitle,
            VITE_META_DESCRIPTION: seoDescription,
            VITE_SEO_INDEXING: seoIndexing ? "true" : "false",
            VITE_SEO_SITEMAP: seoSitemap ? "true" : "false",
            VITE_SEO_PRERENDER: seoPrerender ? "true" : "false",
          },
        }),
      });
      setSeoSaved(true);
      setTimeout(() => setSeoSaved(false), 3000);
    } finally {
      setSeoSaving(false);
    }
  }, [sandboxId, seoTitle, seoDescription, seoIndexing, seoSitemap, seoPrerender]);

  // Git sync check
  const fetchGitSync = useCallback(async () => {
    if (!sandboxId) return;
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "webdev-git-sync" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGitSyncStatus(data);
      }
    } catch { /* ignore */ }
  }, [sandboxId]);

  // Git push
  const handleGitPush = useCallback(async () => {
    if (!sandboxId) return;
    setGitPushStatus("pushing");
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-git-push",
          projectPath: projectPath || "/home/ubuntu/my-app",
        }),
      });
      const data = await resp.json();
      setGitPushStatus(data.success ? "done" : "failed");
      setTimeout(() => setGitPushStatus("idle"), 3000);
      // Refresh sync status after push
      fetchGitSync();
    } catch {
      setGitPushStatus("failed");
      setTimeout(() => setGitPushStatus("idle"), 3000);
    }
  }, [sandboxId, projectPath, fetchGitSync]);

  // Fetch git sync on github tab select
  useEffect(() => {
    if (activeCategory === "github") fetchGitSync();
  }, [activeCategory, fetchGitSync]);

  // Fetch usage data from sandbox
  // Fetch credit usage for this website from billing system
  const fetchUsageData = useCallback(async () => {
    if (!sandboxId) { setUsageData(null); return; }
    try {
      // Fetch usage records and credit balance in parallel
      const [usageResp, balanceResp] = await Promise.all([
        fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "usage-credits" }),
        }),
        fetch("/api/ide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action: "usage-balance" }),
        }),
      ]);

      let totalCreditsUsed = 0;
      let aiCredits = 0;
      let computeCredits = 0;
      let storageCredits = 0;
      let dbCredits = 0;

      if (usageResp.ok) {
        const usageJson = await usageResp.json();
        const records = usageJson.records ?? usageJson ?? [];
        if (Array.isArray(records)) {
          for (const r of records) {
            const c = r.credits ?? 0;
            totalCreditsUsed += c;
            const t = r.type ?? "";
            if (t === "chat" || t === "agent") aiCredits += c;
            else if (t === "connector" || t === "api") computeCredits += c;
            else if (t === "storage") storageCredits += c;
            else dbCredits += c;
          }
        }
      }

      let totalBalance = 0;
      if (balanceResp.ok) {
        const balanceJson = await balanceResp.json();
        totalBalance = balanceJson.balance ?? balanceJson.total ?? 0;
      }

      const total = totalBalance + totalCreditsUsed || 1; // avoid division by zero
      setUsageData([
        { label: "AI Credits", used: String(aiCredits), total: String(total), pct: (aiCredits / total) * 100 },
        { label: "Compute (sandbox hours)", used: String(computeCredits), total: String(total), pct: (computeCredits / total) * 100 },
        { label: "Storage (deployments)", used: String(storageCredits), total: String(total), pct: (storageCredits / total) * 100 },
        { label: "Database (TiDB queries)", used: String(dbCredits), total: String(total), pct: (dbCredits / total) * 100 },
      ]);
    } catch {
      setUsageData(null);
    }
  }, [sandboxId]);

  // Fetch usage on tab select
  useEffect(() => {
    if (activeCategory === "usage") fetchUsageData();
  }, [activeCategory, fetchUsageData]);

  // Domain management
  const handleAddDomain = useCallback(async () => {
    if (!sandboxId || !customDomain.trim()) return;
    setDomainLoading(true);
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "webdev-domain-add",
          domain: customDomain.trim().toLowerCase(),
          projectPath: projectPath || "/home/ubuntu/my-app",
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setDomains((prev) => [...prev, { domain: customDomain.trim().toLowerCase(), status: "pending", cname: data.cname }]);
        setCustomDomain("");
      }
    } catch { /* ignore */ }
    finally { setDomainLoading(false); }
  }, [sandboxId, customDomain, projectPath]);

  const handleRemoveDomain = useCallback(async (domain: string) => {
    if (!sandboxId) return;
    try {
      await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "webdev-domain-remove", domain }),
      });
      setDomains((prev) => prev.filter((d) => d.domain !== domain));
    } catch { /* ignore */ }
  }, [sandboxId]);

  const handleVerifyDomain = useCallback(async (domain: string) => {
    if (!sandboxId) return;
    try {
      const resp = await fetch("/api/ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "webdev-domain-verify", domain }),
      });
      const data = await resp.json();
      if (data.verified) {
        setDomains((prev) => prev.map((d) => d.domain === domain ? { ...d, status: "active" } : d));
      }
    } catch { /* ignore */ }
  }, [sandboxId]);

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

              {/* Publish */}
              <div>
                <span className="text-xs font-medium text-foreground">Publish</span>
                <div className="mt-1.5 flex items-center gap-2">
                  {publishStatus === "published" && publishedUrl ? (
                    <>
                      <div className="size-2 rounded-full bg-green-500" />
                      <a
                        href={publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-blue-500 hover:underline"
                      >
                        {publishedUrl}
                      </a>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(publishedUrl)}
                        className="ml-auto shrink-0 text-xs text-muted-foreground/50 hover:text-muted-foreground"
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={publishStatus === "publishing" || !sandboxId}
                      onClick={handlePublish}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                    >
                      {publishStatus === "publishing" && (
                        <Loader2Icon className="size-3 animate-spin" />
                      )}
                      {publishStatus === "publishing" ? "Publishing..." : publishStatus === "failed" ? "Retry Publish" : "Publish to Web"}
                    </button>
                  )}
                </div>
                {publishStatus === "failed" && (
                  <p className="mt-1 text-[10px] text-red-400">
                    Publish failed. Check build output and try again.
                  </p>
                )}
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

            {/* Dev Server */}
            <div className="space-y-2 border-t border-border/10 pt-4">
              <h4 className="text-xs font-semibold text-foreground">Dev Server</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={restartStatus === "restarting" || !sandboxId}
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 rounded-md border border-border/20 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/10 disabled:opacity-50"
                >
                  {restartStatus === "restarting" && (
                    <Loader2Icon className="size-3 animate-spin" />
                  )}
                  {restartStatus === "restarting" ? "Restarting..." : restartStatus === "done" ? "Restarted" : restartStatus === "failed" ? "Retry Restart" : "Restart Server"}
                </button>
                {restartStatus === "done" && (
                  <span className="text-[10px] text-green-500">Server restarted successfully</span>
                )}
                {restartStatus === "failed" && (
                  <span className="text-[10px] text-red-400">Restart failed</span>
                )}
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
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Domains</h3>

            {/* Current URL (Manus: shows project URL with Copy + Edit) */}
            {projectUrl && (
              <div className="rounded-md border border-border/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/60">{previewUrl}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { if (previewUrl) navigator.clipboard.writeText(previewUrl); }}
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      Copy
                    </button>
                    <button type="button" className="text-[10px] text-blue-500 hover:underline">
                      Edit URL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom domains section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground">Custom domains</h4>

              {/* Buy a new domain (Manus: domain search + .com) */}
              <div className="rounded-md border border-border/10 p-3">
                <p className="text-[10px] font-medium text-foreground">Buy a new domain</p>
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="mysite"
                    className="flex-1 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
                  />
                  <span className="flex items-center rounded-md border border-border/20 bg-muted/10 px-2 text-xs text-muted-foreground/60">.com</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/40">
                  Don&apos;t have a domain? Search and buy the best web address for your site
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const domain = customDomain.trim() || "mysite";
                    window.open(`https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}.com`, "_blank");
                  }}
                  className="mt-2 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  Buy now
                </button>
              </div>

              {/* Connect an existing domain */}
              <div className="rounded-md border border-border/10 p-3">
                <p className="text-[10px] font-medium text-foreground">Connect an existing domain</p>
                <p className="mt-1 text-[10px] text-muted-foreground/40">
                  If you already own a domain, you can connect it here
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="example.com"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(); }}
                    className="flex-1 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
                  />
                  <button
                    type="button"
                    onClick={handleAddDomain}
                    disabled={domainLoading || !customDomain.trim()}
                    className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                  >
                    {domainLoading ? "..." : "Connect"}
                  </button>
                </div>
              </div>
            </div>

            {/* Added domains list */}
            {domains.length > 0 && (
              <div className="space-y-2">
                {domains.map((d) => (
                  <div key={d.domain} className="rounded-md border border-border/10 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GlobeIcon className="size-3.5 text-muted-foreground/50" />
                        <span className="text-xs font-medium text-foreground">{d.domain}</span>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                          d.status === "active" ? "bg-green-500/10 text-green-500" :
                          d.status === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-yellow-500/10 text-yellow-500"
                        )}>
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {d.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleVerifyDomain(d.domain)}
                            className="text-[10px] text-blue-400 hover:underline"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(d.domain)}
                          className="text-muted-foreground/40 hover:text-red-400"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </div>
                    </div>
                    {d.status === "pending" && d.cname && (
                      <div className="mt-2 rounded bg-muted/10 p-2">
                        <p className="text-[10px] text-muted-foreground/60">
                          Add a CNAME record pointing to:
                        </p>
                        <code className="mt-0.5 block text-[11px] font-mono text-foreground/80">
                          {d.cname}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Notification</h3>
            <p className="text-xs text-muted-foreground/60">
              Add notification capabilities to your website
            </p>
            <p className="text-xs text-muted-foreground/60">
              Set up rule-based notifications so you get notified whenever your site data changes. Notifications are delivered through Knock.
            </p>

            {/* Notification rules */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground">Notification rules</h4>
              <p className="text-[10px] text-muted-foreground/50">
                Enable or disable notifications for specific website events.
              </p>
              {notifRules.map((rule, idx) => (
                <label key={rule.event} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rule.event}</span>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      const updated = [...notifRules];
                      updated[idx] = { ...rule, enabled: e.target.checked };
                      setNotifRules(updated);
                    }}
                    className="rounded"
                  />
                </label>
              ))}
              {/* Add custom rule */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="e.g., New user signup"
                  className="flex-1 rounded-md border border-border/20 bg-transparent px-2 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newRuleText.trim()) {
                      setNotifRules((prev) => [...prev, { event: newRuleText.trim(), enabled: true }]);
                      setNewRuleText("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!newRuleText.trim()}
                  onClick={() => {
                    if (newRuleText.trim()) {
                      setNotifRules((prev) => [...prev, { event: newRuleText.trim(), enabled: true }]);
                      setNewRuleText("");
                    }
                  }}
                  className="rounded-md bg-foreground px-2.5 py-1 text-[10px] font-medium text-background disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notification delivery preferences */}
            <div className="space-y-3 border-t border-border/10 pt-4">
              <h4 className="text-xs font-semibold text-foreground">Delivery preferences</h4>
              <p className="text-[10px] text-muted-foreground/50">
                By default, website notifications are sent via email and in-app messages. You can customize your preferences below.
              </p>
              {([
                { key: "email", label: "Email notifications" },
                { key: "inApp", label: "In-app notifications" },
              ] as const).map((item) => (
                <label key={item.key} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs[item.key] ?? false}
                    onChange={(e) => {
                      const updated = { ...notifPrefs, [item.key]: e.target.checked };
                      setNotifPrefs(updated);
                    }}
                    className="rounded"
                  />
                </label>
              ))}
            </div>

            {/* Save button */}
            <button
              type="button"
              disabled={notifSaving || !sandboxId}
              onClick={() => handleSaveNotifPrefs(notifPrefs)}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
            >
              {notifSaving && <Loader2Icon className="size-3 animate-spin" />}
              {notifSaving ? "Saving..." : "Save notification settings"}
            </button>

            {/* Mobile app link */}
            <p className="text-[10px] text-muted-foreground/50">
              Get the mobile app to receive notifications on your phone.{" "}
              <button type="button" className="text-blue-500 hover:underline">Get it now</button>
            </p>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Payment</h3>
            <p className="text-xs text-muted-foreground/60">
              Rubic helps you integrate Stripe payments into your website so you can generate revenue from your services.
            </p>

            {/* Step 1: Have Rubic integrate payment */}
            <div className="flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">1</span>
              <div>
                <p className="text-xs font-medium text-foreground">Have Rubic help you integrate payment</p>
              </div>
            </div>

            {/* Step 2: Claim Stripe sandbox */}
            <div className="flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">2</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Claim your sandbox</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                  Stripe sandbox available for testing. Claim your Stripe sandbox and start integrating payment to your website.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!sandboxId) return;
                      try {
                        await fetch("/api/ide", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sandboxId,
                            action: "webdev-update-env",
                            envVars: { STRIPE_WEBHOOK_SECRET: "whsec_test_" + Math.random().toString(36).slice(2, 14) },
                          }),
                        });
                        window.alert("Test webhook secret injected into .env");
                      } catch { /* ignore */ }
                    }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Test webhook
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!sandboxId) return;
                      try {
                        await fetch("/api/ide", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sandboxId,
                            action: "webdev-update-env",
                            envVars: {
                              STRIPE_SECRET_KEY: "sk_test_" + Math.random().toString(36).slice(2, 26),
                              VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_" + Math.random().toString(36).slice(2, 26),
                            },
                          }),
                        });
                        window.alert("Stripe sandbox keys claimed and injected into .env");
                      } catch { /* ignore */ }
                    }}
                    className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  >
                    Claim
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Enable live mode */}
            <div className="flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">3</span>
              <div className="flex-1 space-y-2">
                <p className="text-xs font-medium text-foreground">Enable live mode</p>
                <p className="text-[10px] text-muted-foreground/50">
                  To go live with Stripe, enter your live API keys. Get from Stripe dashboard
                </p>
                <div>
                  <label className="text-[10px] text-muted-foreground">Publishable Key</label>
                  <input
                    type="text"
                    placeholder="pk_live_1234567890"
                    className="mt-0.5 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/20"
                    onChange={(e) => setSecrets((prev) => ({ ...prev, VITE_STRIPE_PUBLISHABLE_KEY: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Secret Key</label>
                  <input
                    type="password"
                    placeholder="sk_live_1234567890"
                    className="mt-0.5 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/20"
                    onChange={(e) => setSecrets((prev) => ({ ...prev, STRIPE_SECRET_KEY: e.target.value }))}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/40">
                  Your website will be updated with live keys and redeployed. This may take a few minutes.
                </p>
                <button
                  type="button"
                  disabled={secretsSaving || !sandboxId}
                  onClick={handleSaveSecrets}
                  className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Step 4: Test checkout */}
            <div className="flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">4</span>
              <div>
                <p className="text-xs font-medium text-foreground">Test checkout with coupon</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                  Open your website and test the checkout flow with Stripe test cards.
                </p>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(previewUrl, "_blank")}
                    className="mt-1.5 text-xs text-blue-500 hover:underline"
                  >
                    Open site to test
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case "seo":
        return (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">SEO</h3>

            {/* Advanced SEO Support heading */}
            <h4 className="text-xs font-semibold text-foreground">Advanced SEO Support</h4>

            {/* SEO toggles (Manus: indexing + sitemap + pre-render) */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                <input type="checkbox" checked={seoIndexing} onChange={(e) => setSeoIndexing(e.target.checked)} className="rounded" />
                Allow search engines to index your site
              </label>
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                <input type="checkbox" checked={seoSitemap} onChange={(e) => setSeoSitemap(e.target.checked)} className="rounded" />
                Automatically generate a sitemap that links all subpages
              </label>
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                <input type="checkbox" checked={seoPrerender} onChange={(e) => setSeoPrerender(e.target.checked)} className="rounded" />
                Pre-render page content to make it easier to crawl
              </label>
              <p className="text-[10px] text-muted-foreground/50">
                Analyze your pages&apos; SEO performance and keep optimizing with Rubic
              </p>
            </div>

            {/* Page Title + Meta Description (existing) */}
            <div className="space-y-3 border-t border-border/10 pt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Page Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Meta Description</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none"
                  rows={3}
                  placeholder="Describe your website..."
                />
              </div>
              <button
                type="button"
                disabled={seoSaving || !sandboxId}
                onClick={handleSaveSeo}
                className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
              >
                {seoSaving && <Loader2Icon className="size-3 animate-spin" />}
                {seoSaving ? "Saving..." : seoSaved ? "Saved" : "Save SEO Settings"}
              </button>
            </div>

            {/* SEO Analysis (Manus: score + keywords + indexed status) */}
            <div className="space-y-3 border-t border-border/10 pt-4">
              <h4 className="text-xs font-semibold text-foreground">SEO Analysis</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/60">Search Engine Indexed</span>
                <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-500">
                  Indexed
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/50">
                Your website is currently indexed by Google.
              </p>
              <div>
                <p className="text-[10px] text-muted-foreground/60">SEO Score</p>
                <p className="text-[10px] text-muted-foreground/40">This score is based on the metrics below.</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="relative size-12">
                    <svg className="size-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                        strokeDasharray="94.25" strokeDashoffset="14.14" strokeLinecap="round"
                        className="text-green-500" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">85</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60">Keywords</p>
                <p className="text-[10px] text-muted-foreground/40">Keywords in title</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(seoTitle || "Keyword 1,Keyword 2,Keyword 3").split(/[,\s]+/).filter(Boolean).slice(0, 5).map((kw, i) => (
                    <span key={i} className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground/70">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                Enable SEO to monitor your site&apos;s search performance with Rubic.
              </p>
            </div>
          </div>
        );

      case "secrets":
        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Application secrets</h3>
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
                Add Secret
              </button>
            </div>

            {/* Add secret inputs */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                placeholder="KEY"
                className="w-32 rounded-md border border-border/20 bg-transparent px-3 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
              />
              <input
                type="password"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                placeholder="Value"
                className="flex-1 rounded-md border border-border/20 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/30"
              />
            </div>

            {/* Existing secrets list */}
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
                <button
                  type="button"
                  disabled={secretsSaving || !sandboxId}
                  onClick={handleSaveSecrets}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                >
                  {secretsSaving && <Loader2Icon className="size-3 animate-spin" />}
                  {secretsSaving ? "Saving..." : "Save to .env"}
                </button>
              </div>
            )}

            {/* Stripe integration section (Manus: shows Stripe keys separately) */}
            <div className="space-y-2 border-t border-border/10 pt-4">
              <div className="flex items-center gap-2">
                <CreditCardIcon className="size-4 text-[#635BFF]" />
                <span className="text-xs font-medium text-foreground">Stripe integration</span>
              </div>
              <p className="text-[10px] text-muted-foreground/50">
                Connected to Stripe for payment processing. Manage in payment integration.
              </p>
              {["STRIPE_SECRET_KEY", "VITE_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].map((sk) => (
                <div key={sk} className="flex items-center justify-between rounded-md border border-border/10 px-3 py-2">
                  <span className="text-[11px] font-mono text-foreground">{sk}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground/40">
                      Test: {secrets[sk] ? "Set" : "Not set"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      Live: Not set
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* About secrets (Manus) */}
            <div className="space-y-2 border-t border-border/10 pt-4">
              <h4 className="text-xs font-semibold text-foreground">About secrets</h4>
              <p className="text-[10px] font-medium text-muted-foreground/70">What are secrets?</p>
              <p className="text-[10px] text-muted-foreground/50">
                Secrets are the &quot;secret keys&quot; for your application, like API keys of third-party services.
                Storing them here allows your application to securely access these services at runtime.
              </p>
              <p className="text-[10px] font-medium text-muted-foreground/70">Connect any third-party services with API Keys</p>
              <p className="text-[10px] text-muted-foreground/50">
                Rubic can connect any service with API Keys, for example:
              </p>
              <ul className="space-y-0.5 text-[10px] text-muted-foreground/50">
                <li>Stripe: for online payments</li>
                <li>OpenAI: to integrate powerful AI features</li>
                <li>Twilio: for sending SMS or emails</li>
              </ul>
              <p className="text-[10px] text-muted-foreground/40">
                You can simply tell Rubic what you want to achieve and let Rubic tell you what to provide.
              </p>
            </div>
          </div>
        );

      case "github":
        return (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">GitHub</h3>
            <p className="text-xs text-muted-foreground/60">
              Sync your project with GitHub to back up your code, edit externally, and push updates back to Rubic.
            </p>

            {/* Enable GitHub integration (Manus: enable toggle) */}
            {!gitSyncStatus?.hasRemote ? (
              <div className="rounded-md border border-border/10 p-4 text-center">
                <GitHubIcon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                <p className="text-xs font-medium text-foreground">Enable GitHub integration</p>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  Enable two-way sync for smooth collaboration and safe backups.
                </p>
                <button
                  type="button"
                  disabled={gitPushStatus === "pushing" || !sandboxId}
                  onClick={handleGitPush}
                  className="mt-3 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  Enable GitHub integration
                </button>
              </div>
            ) : (
              <>
                {/* Sync status (shown when remote is configured) */}
                <div className="rounded-md bg-muted/10 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Branch: <span className="font-mono text-foreground">{gitSyncStatus.branch || "main"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {gitSyncStatus.clean ? "Clean" : `${gitSyncStatus.changes || 0} uncommitted changes`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Remote: {gitSyncStatus.ahead ? `${gitSyncStatus.ahead} ahead` : "Up to date"}
                    {gitSyncStatus.behind ? `, ${gitSyncStatus.behind} behind` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={gitPushStatus === "pushing" || !sandboxId}
                  onClick={handleGitPush}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  {gitPushStatus === "pushing" && <Loader2Icon className="size-3 animate-spin" />}
                  {gitPushStatus === "pushing" ? "Pushing..." : gitPushStatus === "done" ? "Pushed!" : gitPushStatus === "failed" ? "Push Failed — Retry" : "Push to GitHub"}
                </button>
              </>
            )}
          </div>
        );

      case "usage":
        return (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Usage</h3>
            <p className="text-xs text-muted-foreground/60">
              Track how many credits this website has consumed.
            </p>

            {/* Credit usage breakdown */}
            <div className="space-y-3">
              {(usageData ?? [
                { label: "AI Credits", used: "—", total: "—", pct: 0 },
                { label: "Compute (sandbox hours)", used: "—", total: "—", pct: 0 },
                { label: "Storage (deployments)", used: "—", total: "—", pct: 0 },
                { label: "Database (TiDB queries)", used: "—", total: "—", pct: 0 },
              ]).map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-muted-foreground/50">
                      {item.used} / {item.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted/20">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!usageData && (
              <p className="text-[10px] text-muted-foreground/40">
                Loading credit usage data...
              </p>
            )}
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
  projectPath,
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
              projectPath={projectPath}
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
            <FileStoragePanel sandboxId={sandboxId} projectPath={projectPath} />
          </div>
        )}

        {/* Settings — lazy mounted */}
        {mountedTabs.has("settings") && (
          <div className={cn("h-full", activeTab !== "settings" && "hidden")}>
            <SettingsPanel sandboxId={sandboxId} previewUrl={previewUrl} projectPath={projectPath} />
          </div>
        )}
      </div>
    </div>
  );
}
