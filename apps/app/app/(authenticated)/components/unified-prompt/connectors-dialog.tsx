"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@repo/design-system/components/ui/dialog";
import { cn } from "@repo/design-system/lib/utils";
import {
  SearchIcon,
  Loader2Icon,
  CableIcon,
  CheckCircle2Icon,
  PlusIcon,
  KeyRoundIcon,
  ServerIcon,
  XIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

type TabId = "apps" | "custom-api" | "custom-mcp";

interface ConnectorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Tab definitions
// ============================================================================

const TABS: { id: TabId; label: string }[] = [
  { id: "apps", label: "Apps" },
  { id: "custom-api", label: "Custom API" },
  { id: "custom-mcp", label: "Custom MCP" },
];

// Featured/recommended connector types
const RECOMMENDED_TYPES = ["gmail", "github"];

// ============================================================================
// Component
// ============================================================================

export function ConnectorsDialog({ open, onOpenChange }: ConnectorsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("apps");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();

  // Definitions are static — prefetch eagerly so dialog opens instantly
  const { data: definitions, isLoading: loadingDefs } = trpc.connectors.listDefinitions.useQuery(
    undefined,
    {
      staleTime: 5 * 60_000, // 5 min — definitions rarely change
    }
  );

  // User connectors refetch when dialog opens, but keep cache so it's instant on re-open
  const { data: userConnectors, isLoading: loadingUser } = trpc.connectors.list.useQuery(
    undefined,
    {
      enabled: open,
      staleTime: 15_000,
      refetchOnMount: "always",
    }
  );

  const [connectingDefId, setConnectingDefId] = useState<string | null>(null);
  const [apiKeyDef, setApiKeyDef] = useState<{ id: string; type: string; name: string } | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const checkConnection = trpc.connectors.checkConnection.useMutation();

  const connectWithApiKey = trpc.connectors.connectWithApiKey.useMutation({
    onSuccess: (_data, variables) => {
      const def = definitions?.find((d) => d.type === variables.type);
      toast.success(`${def?.name ?? variables.type} connected!`);
      setApiKeyDef(null);
      setApiKeyValue("");
      utils.connectors.list.invalidate();
      utils.connectors.listDefinitions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save API key");
    },
  });

  const initOAuth = trpc.connectors.initializeOAuth.useMutation({
    onSuccess: (data) => {
      const popup = window.open(data.authUrl, "oauth", "width=600,height=700,popup=true");
      if (!popup) {
        toast.error("Please allow popups for this site to connect apps.");
        setConnectingDefId(null);
        return;
      }

      // Poll for popup close, then check status with retries + backoff
      const check = setInterval(async () => {
        if (popup.closed) {
          clearInterval(check);

          const def = definitions?.find((d) => d.id === connectingDefId);
          if (def) {
            let connected = false;
            const maxAttempts = 3;
            const delays = [1000, 3000, 5000];

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              try {
                const result = await checkConnection.mutateAsync({ type: def.type });
                if (result.status === "connected") {
                  toast.success(`${def.name} connected!`);
                  connected = true;
                  break;
                }
                if (result.status === "error") {
                  toast.error(`Failed to connect ${def.name}.`);
                  break;
                }
              } catch {
                // retry
              }
              if (attempt < maxAttempts - 1) {
                await new Promise((r) => setTimeout(r, delays[attempt]));
              }
            }

            if (!connected) {
              toast.info("Connection pending. Check Applications page for status.");
            }
          }

          setConnectingDefId(null);
          utils.connectors.list.invalidate();
          utils.connectors.listDefinitions.invalidate();
        }
      }, 500);
    },
    onError: (error) => {
      setConnectingDefId(null);
      toast.error(error.message || "Failed to start connection");
    },
  });

  const uninstallMutation = trpc.connectors.uninstall.useMutation({
    onSuccess: () => {
      utils.connectors.list.invalidate();
    },
  });

  // Listen for postMessage from OAuth callback popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "composio-oauth-callback") {
        if (event.data.status === "failed") {
          toast.error("OAuth authorization was denied or failed.");
          setConnectingDefId(null);
        }
        utils.connectors.list.invalidate();
        utils.connectors.listDefinitions.invalidate();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [utils]);

  // Build a map: definitionId → userConnector (for quick status lookup)
  const installedMap = useMemo(() => {
    const map = new Map<string, { id: string; status: string; connectorDefinitionId: string }>();
    if (userConnectors) {
      for (const uc of userConnectors) {
        map.set(uc.connector.connectorDefinitionId, {
          id: uc.connector.id,
          status: uc.connector.status,
          connectorDefinitionId: uc.connector.connectorDefinitionId,
        });
      }
    }
    return map;
  }, [userConnectors]);

  // Filtered definitions for search
  const filteredDefs = useMemo(() => {
    if (!definitions) return [];
    if (!search) return definitions;
    const lower = search.toLowerCase();
    return definitions.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        (d.description ?? "").toLowerCase().includes(lower) ||
        d.category.toLowerCase().includes(lower)
    );
  }, [definitions, search]);

  // Split into recommended + rest
  const recommended = useMemo(
    () => filteredDefs.filter((d) => RECOMMENDED_TYPES.includes(d.type)),
    [filteredDefs]
  );

  const allApps = filteredDefs;

  const handleInstall = useCallback(
    (defId: string) => {
      if (initOAuth.isPending || connectingDefId || connectWithApiKey.isPending) return;
      const def = definitions?.find((d) => d.id === defId);
      if (!def) return;

      if (def.authType === "api_key") {
        // Show API key input form instead of OAuth popup
        setApiKeyDef({ id: def.id, type: def.type, name: def.name });
        setApiKeyValue("");
        return;
      }

      // OAuth flow
      setConnectingDefId(defId);
      initOAuth.mutate({ type: def.type });
    },
    [initOAuth, connectingDefId, connectWithApiKey.isPending, definitions]
  );

  const handleApiKeySubmit = useCallback(() => {
    if (!apiKeyDef || !apiKeyValue.trim() || connectWithApiKey.isPending) return;
    connectWithApiKey.mutate({ type: apiKeyDef.type, apiKey: apiKeyValue.trim() });
  }, [apiKeyDef, apiKeyValue, connectWithApiKey]);

  const handleUninstall = useCallback(
    (connectorId: string) => {
      if (uninstallMutation.isPending) return;
      uninstallMutation.mutate({ id: connectorId });
    },
    [uninstallMutation]
  );

  // Only show full loading state if we have zero definitions yet
  // (subsequent opens show stale data while refetching in background)
  const isLoading = !definitions && (loadingDefs || loadingUser);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-[800px] w-[800px] h-[680px] max-h-[95vh] p-0 gap-0 rounded-[20px] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="pt-5 pe-14 pb-4 ps-6 shrink-0">
          <DialogTitle className="text-[18px] leading-[24px] font-semibold">Connectors</DialogTitle>
        </div>

        {/* Tabs + Search bar */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden -mt-[6px] pt-2">
          <div className="px-6 shrink-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border">
              {/* Tabs */}
              <div className="flex items-center gap-2 h-[44px]">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative z-10 min-w-[42px] px-2 py-3 text-[14px] leading-[20px] font-medium tracking-[-0.154px] transition-colors duration-200 cursor-pointer",
                      activeTab === tab.id
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-foreground rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-[6px] overflow-hidden bg-accent/50 focus-within:ring-1 focus-within:ring-border w-[200px] h-8 rounded-lg px-3 py-1 text-[13px] leading-[18px] tracking-[-0.091px]">
                <SearchIcon
                  className="text-muted-foreground shrink-0"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search"
                  aria-label="Search connectors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-full min-w-[4px] flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Content area (scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === "apps" && (
              <AppsTab
                recommended={recommended}
                allApps={allApps}
                installedMap={installedMap}
                isLoading={isLoading}
                search={search}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                connectingDefId={connectingDefId}
              />
            )}
            {activeTab === "custom-api" && <CustomApiTab />}
            {activeTab === "custom-mcp" && <CustomMcpTab />}
          </div>
        </div>

        {/* API Key input overlay */}
        {apiKeyDef && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-10 rounded-[20px]">
            <div className="w-[400px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold leading-[22px]">
                  Connect {apiKeyDef.name}
                </h3>
                <button
                  type="button"
                  onClick={() => { setApiKeyDef(null); setApiKeyValue(""); }}
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                >
                  <XIcon size={16} />
                </button>
              </div>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                Enter your API key to connect {apiKeyDef.name}. You can find this in your {apiKeyDef.name} account settings.
              </p>
              <div className="space-y-2">
                <label htmlFor="api-key-input" className="text-[13px] font-medium text-foreground">
                  API Key
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleApiKeySubmit(); }}
                  placeholder="Enter your API key..."
                  autoFocus
                  className="w-full h-9 px-3 rounded-lg border border-border bg-secondary text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setApiKeyDef(null); setApiKeyValue(""); }}
                  className="h-8 px-3 text-[13px] font-medium rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApiKeySubmit}
                  disabled={!apiKeyValue.trim() || connectWithApiKey.isPending}
                  className="h-8 px-4 text-[13px] font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {connectWithApiKey.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Apps Tab
// ============================================================================

interface ConnectorDef {
  id: string;
  type: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  authType: string;
  isPremium: boolean;
}

interface AppsTabProps {
  recommended: ConnectorDef[];
  allApps: ConnectorDef[];
  installedMap: Map<string, { id: string; status: string; connectorDefinitionId: string }>;
  isLoading: boolean;
  search: string;
  onInstall: (defId: string) => void;
  onUninstall: (connectorId: string) => void;
  connectingDefId: string | null;
}

function AppsTab({
  recommended,
  allApps,
  installedMap,
  isLoading,
  search,
  onInstall,
  onUninstall,
  connectingDefId,
}: AppsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allApps.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">
          {search ? "No connectors match your search." : "No connectors available."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 pt-6 space-y-6 pb-6">
      {/* Recommended section */}
      {!search && recommended.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] leading-[20px] text-muted-foreground tracking-[-0.154px]">
            Recommend
          </p>
          <div className="flex gap-3">
            {recommended.map((def) => (
              <RecommendedCard
                key={def.id}
                def={def}
                installed={installedMap.get(def.id)}
                onInstall={onInstall}
                onUninstall={onUninstall}
                isConnecting={connectingDefId === def.id}
                isAnyConnecting={!!connectingDefId}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Apps section */}
      <div className="flex flex-col gap-3">
        <p className="text-[14px] leading-[20px] text-muted-foreground tracking-[-0.154px]">Apps</p>
        <div className="grid gap-3 md:grid-cols-2">
          {allApps.map((def) => (
            <AppCard
              key={def.id}
              def={def}
              installed={installedMap.get(def.id)}
              onInstall={onInstall}
              onUninstall={onUninstall}
              isConnecting={connectingDefId === def.id}
              isAnyConnecting={!!connectingDefId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Recommended Card (larger, 2-col featured)
// ============================================================================

interface CardProps {
  def: ConnectorDef;
  installed?: { id: string; status: string; connectorDefinitionId: string };
  onInstall: (defId: string) => void;
  onUninstall: (connectorId: string) => void;
  isConnecting: boolean;
  isAnyConnecting: boolean;
}

function RecommendedCard({ def, installed, onInstall, onUninstall, isConnecting, isAnyConnecting }: CardProps) {
  const isConnected = installed?.status === "connected";
  const isPending = installed?.status === "pending";
  const isInstalled = !!installed;
  const isDisabled = isAnyConnecting && !isConnecting;

  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-3 px-4 py-3 min-h-[84px] bg-secondary rounded-xl border border-border max-w-[50%] transition-all duration-200",
        isConnecting && "border-foreground/30 ring-1 ring-foreground/10",
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent/50"
      )}
      onClick={() => {
        if (isDisabled) return;
        if (isInstalled && !isConnecting) {
          onUninstall(installed!.id);
        } else if (!isConnecting) {
          onInstall(def.id);
        }
      }}
    >
      <div className="relative flex items-center justify-center size-10 bg-secondary rounded-lg border border-border shrink-0">
        {isConnecting ? (
          <Loader2Icon className="size-5 animate-spin text-foreground" />
        ) : def.icon ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt={def.name}
            src={def.icon}
            className="w-6 h-6"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <CableIcon className="text-muted-foreground" size={24} />
        )}
      </div>
      <div className="flex flex-col items-start justify-center min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[14px] font-medium leading-[20px] text-foreground tracking-[-0.154px]">
            {def.name}
          </span>
          {isConnected && <CheckCircle2Icon className="size-3.5 text-green-500 shrink-0" />}
          {isPending && !isConnecting && (
            <span className="text-[10px] font-medium leading-[14px] text-amber-500 px-1 py-0.5 bg-amber-500/10 rounded">
              Pending
            </span>
          )}
          {def.isPremium && (
            <span className="bg-blue-500/10 text-blue-500 text-[10px] font-medium leading-[14px] px-1 py-0.5 rounded">
              NEW
            </span>
          )}
        </div>
        <p className="text-[12px] leading-[16px] text-muted-foreground line-clamp-2">
          {isConnecting ? "Connecting..." : def.description}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// App Card (regular grid item)
// ============================================================================

function AppCard({ def, installed, onInstall, onUninstall, isConnecting, isAnyConnecting }: CardProps) {
  const isConnected = installed?.status === "connected";
  const isPending = installed?.status === "pending";
  const isInstalled = !!installed;
  const isDisabled = isAnyConnecting && !isConnecting;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 min-h-[76px] bg-secondary rounded-xl border border-border transition-all duration-200",
        isConnecting && "border-foreground/30 ring-1 ring-foreground/10",
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent/50"
      )}
      onClick={() => {
        if (isDisabled) return;
        if (isInstalled && !isConnecting) {
          onUninstall(installed!.id);
        } else if (!isConnecting) {
          onInstall(def.id);
        }
      }}
    >
      <div className="relative flex items-center justify-center size-10 bg-secondary rounded-lg border border-border shrink-0">
        {isConnecting ? (
          <Loader2Icon className="size-5 animate-spin text-foreground" />
        ) : def.icon ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt={def.name}
            src={def.icon}
            className="w-6 h-6"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <CableIcon className="text-muted-foreground" size={24} />
        )}
      </div>
      <div className="flex flex-col items-start justify-center min-w-0 flex-1">
        <div className="w-full overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-medium leading-[20px] text-foreground tracking-[-0.154px] truncate">
              {def.name}
            </span>
            {isConnected && <CheckCircle2Icon className="size-3.5 text-green-500 shrink-0" />}
            {isPending && !isConnecting && (
              <span className="text-[10px] font-medium leading-[14px] text-amber-500 px-1 py-0.5 bg-amber-500/10 rounded shrink-0">
                Pending
              </span>
            )}
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <p className="text-[12px] font-normal leading-[16px] text-muted-foreground tracking-[-0.091px] line-clamp-2">
            {isConnecting ? "Connecting..." : def.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Custom API Tab
// ============================================================================

function CustomApiTab() {
  return (
    <div className="flex-1 px-6 pt-6 space-y-3 pb-6">
      {/* Info banner */}
      <div className="flex gap-2.5 items-start p-3 bg-accent/30 rounded-xl">
        <div className="flex items-center justify-center size-4 shrink-0 mt-0.5">
          <KeyRoundIcon
            className="text-muted-foreground"
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-[18px] text-muted-foreground tracking-[-0.091px]">
            Connect Rubic programmatically to any third-party service using your own API keys.
          </p>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid gap-3 md:grid-cols-2 justify-center pb-6">
        <div className="flex items-center justify-center gap-3 px-4 py-3 min-h-[76px] bg-secondary rounded-xl cursor-pointer border border-border hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-1.5">
            <PlusIcon className="text-foreground" size={20} strokeWidth={2} />
            <span className="text-[14px] font-medium leading-[20px] text-foreground tracking-[-0.154px]">
              Add custom API
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Custom MCP Tab
// ============================================================================

function CustomMcpTab() {
  return (
    <div className="flex-1 px-6 pt-6 space-y-3 pb-6">
      {/* Info banner */}
      <div className="flex gap-2.5 items-start p-3 bg-accent/30 rounded-xl">
        <div className="flex items-center justify-center size-4 shrink-0 mt-0.5">
          <ServerIcon
            className="text-muted-foreground"
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-[18px] text-muted-foreground tracking-[-0.091px]">
            Connect Rubic to custom MCP servers for extended tool capabilities and integrations.
          </p>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid gap-3 md:grid-cols-2 justify-center pb-6">
        <div className="flex items-center justify-center gap-3 px-4 py-3 min-h-[76px] bg-secondary rounded-xl cursor-pointer border border-border hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-1.5">
            <PlusIcon className="text-foreground" size={20} strokeWidth={2} />
            <span className="text-[14px] font-medium leading-[20px] text-foreground tracking-[-0.154px]">
              Add MCP server
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
