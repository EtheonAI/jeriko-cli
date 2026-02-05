"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { SearchIcon, RefreshCwIcon, AppWindowIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { AppCard } from "./components/app-card";
import { CategoryFilter, type CategoryValue } from "./components/category-filter";
import { AppConfigPanel } from "./components/app-config-panel";

type Tab = "connected" | "available";

export function ApplicationsPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryValue>("all");
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [connectingDefId, setConnectingDefId] = useState<string | null>(null);

  // Data fetching
  const {
    data: definitions,
    isLoading: isLoadingDefs,
    isError: isDefsError,
    refetch: refetchDefs,
  } = trpc.connectors.listDefinitions.useQuery(undefined, { retry: 1 });

  const {
    data: installedConnectors,
    isLoading: isLoadingInstalled,
    isError: isInstalledError,
    refetch: refetchInstalled,
  } = trpc.connectors.list.useQuery(undefined, { retry: 1 });

  const utils = trpc.useUtils();

  // Mutations
  const installConnector = trpc.connectors.install.useMutation({
    onSuccess: (_data, variables) => {
      utils.connectors.list.invalidate();
      // After installing, start OAuth
      startOAuth(variables.connectorDefinitionId);
    },
    onError: (error) => {
      setConnectingDefId(null);
      if (error.message.includes("already installed")) {
        // Already installed, find the connector and start OAuth
        const existing = installedConnectors?.find((c) => c.definition.id === connectingDefId);
        if (existing) {
          startOAuth(existing.definition.id);
        }
      } else {
        toast.error(error.message || "Failed to connect");
      }
    },
  });

  const initOAuth = trpc.connectors.initializeOAuth.useMutation({
    onSuccess: (data) => {
      // Open OAuth popup
      const popup = window.open(data.authUrl, "oauth", "width=600,height=700,popup=true");
      if (!popup) {
        toast.error("Please allow popups for this site to connect apps.");
        setConnectingDefId(null);
        return;
      }
      // Poll for popup close
      const check = setInterval(() => {
        if (popup.closed) {
          clearInterval(check);
          setConnectingDefId(null);
          utils.connectors.list.invalidate();
          utils.connectors.listDefinitions.invalidate();
          toast.success("Connection flow completed. Checking status...");
        }
      }, 500);
    },
    onError: (error) => {
      setConnectingDefId(null);
      toast.error(error.message || "Failed to start connection");
    },
  });

  const startOAuth = useCallback(
    (definitionId: string) => {
      const def = definitions?.find((d) => d.id === definitionId);
      if (def) {
        initOAuth.mutate({ type: def.type });
      }
    },
    [definitions, initOAuth]
  );

  const handleConnect = useCallback(
    (definitionId: string, _type: string) => {
      setConnectingDefId(definitionId);
      // Check if already installed
      const existing = installedConnectors?.find((c) => c.definition.id === definitionId);
      if (existing) {
        // Already installed, go straight to OAuth
        const def = definitions?.find((d) => d.id === definitionId);
        if (def) {
          initOAuth.mutate({ type: def.type });
        }
      } else {
        // Install first (will trigger OAuth on success)
        installConnector.mutate({ connectorDefinitionId: definitionId });
      }
    },
    [installedConnectors, definitions, initOAuth, installConnector]
  );

  const handleConfigure = useCallback((connectorId: string) => {
    setConfigConnectorId(connectorId);
    setConfigOpen(true);
  }, []);

  const handleReconnect = useCallback(
    (definitionId: string, type: string) => {
      setConfigOpen(false);
      handleConnect(definitionId, type);
    },
    [handleConnect]
  );

  // Build connected lookup map (definitionId -> installed connector)
  const installedMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof installedConnectors>[number]>();
    installedConnectors?.forEach((c) => {
      map.set(c.definition.id, c);
    });
    return map;
  }, [installedConnectors]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (activeTab === "connected") {
      installedConnectors?.forEach((c) => {
        const cat = c.definition.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      });
    } else {
      definitions?.forEach((d) => {
        const cat = d.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }
    return counts;
  }, [activeTab, definitions, installedConnectors]);

  // Filtered definitions (for "Available" tab)
  const filteredDefinitions = useMemo(() => {
    if (!definitions) return [];
    const searchLower = search.toLowerCase();
    return definitions.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (
        search &&
        !d.name.toLowerCase().includes(searchLower) &&
        !d.description?.toLowerCase().includes(searchLower)
      )
        return false;
      return true;
    });
  }, [definitions, category, search]);

  // Filtered connected apps (for "Connected" tab)
  const filteredConnected = useMemo(() => {
    if (!installedConnectors) return [];
    const searchLower = search.toLowerCase();
    return installedConnectors.filter((c) => {
      if (category !== "all" && c.definition.category !== category) return false;
      if (
        search &&
        !c.definition.name.toLowerCase().includes(searchLower) &&
        !c.definition.description?.toLowerCase().includes(searchLower)
      )
        return false;
      return true;
    });
  }, [installedConnectors, category, search]);

  const isLoading = isLoadingDefs || isLoadingInstalled;
  const isError = isDefsError || isInstalledError;
  const connectedCount = installedConnectors?.length ?? 0;
  const availableCount = definitions?.length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-muted-foreground">Connect and manage your external applications</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-muted-foreground">Connect and manage your external applications</p>
          </div>
        </div>
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Failed to load applications. Please try again.
          </p>
          <Button
            onClick={() => {
              refetchDefs();
              refetchInstalled();
            }}
            variant="outline"
            className="gap-2"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Connect and manage your external applications</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchDefs();
            refetchInstalled();
          }}
          className="gap-2"
        >
          <RefreshCwIcon className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab("connected")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "connected"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Connected
            {connectedCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">{connectedCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("available")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "available"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Available
            {availableCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">{availableCount}</span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
      </div>

      {/* Category Filter */}
      <CategoryFilter selected={category} onSelect={setCategory} counts={categoryCounts} />

      {/* App Grid */}
      {activeTab === "available" ? (
        filteredDefinitions.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDefinitions.map((def) => (
              <AppCard
                key={def.id}
                definition={def}
                connection={installedMap.get(def.id)}
                onConnect={handleConnect}
                onConfigure={handleConfigure}
                isConnecting={connectingDefId === def.id}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            message={search ? "No applications match your search" : "No applications available yet"}
            onAction={search ? () => setSearch("") : undefined}
            actionLabel={search ? "Clear search" : undefined}
          />
        )
      ) : filteredConnected.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredConnected.map(({ connector, definition }) => (
            <AppCard
              key={connector.id}
              definition={definition}
              connection={{ connector, definition }}
              onConnect={handleConnect}
              onConfigure={handleConfigure}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          message={
            search ? "No connected applications match your search" : "No applications connected yet"
          }
          description={
            search
              ? undefined
              : "Browse available applications and connect them to extend Rubic's capabilities."
          }
          onAction={() => {
            if (search) {
              setSearch("");
            } else {
              setActiveTab("available");
            }
          }}
          actionLabel={search ? "Clear search" : "Browse applications"}
        />
      )}

      {/* Config Panel */}
      <AppConfigPanel
        connectorId={configConnectorId}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onReconnect={handleReconnect}
      />
    </div>
  );
}

function EmptyState({
  message,
  description,
  onAction,
  actionLabel,
}: {
  message: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <AppWindowIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-sm font-medium">{message}</h3>
      {description && (
        <p className="mt-1 text-center text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
      {onAction && actionLabel && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4 gap-2">
          <PlusIcon className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
