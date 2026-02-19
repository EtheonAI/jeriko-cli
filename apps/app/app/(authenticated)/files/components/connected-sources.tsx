"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  PlusIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";
import {
  useGetConnectorsByCategoryQuery,
  useGetInstalledConnectorsQuery,
  useInitializeOAuthMutation,
  useCheckConnectionMutation,
} from "@/lib/store/api/api.slice";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  setFileConnectorList,
  type FileConnectorItem,
  type FileConnectorAppType,
} from "@/lib/store/slices/fileConnector.slice";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";
import { CloudFileBrowser } from "./cloud-file-browser";

// File/email provider types we show in the connected sources strip
const FILE_PROVIDER_CATEGORIES = ["storage", "communication"] as const;

// Map connector types to FileConnectorAppType + metadata
const CONNECTOR_META: Record<
  string,
  { appType: FileConnectorAppType; connectorType: "cloud_storage" | "document" | "knowledge_base" }
> = {
  google_drive: { appType: "google_drive", connectorType: "cloud_storage" },
  onedrive: { appType: "onedrive", connectorType: "cloud_storage" },
  dropbox: { appType: "dropbox", connectorType: "cloud_storage" },
  box: { appType: "box", connectorType: "cloud_storage" },
  notion: { appType: "notion", connectorType: "document" },
  confluence: { appType: "confluence", connectorType: "knowledge_base" },
};

// Connectors to show in the strip (storage + email)
const SHOWN_TYPES = new Set([
  "google_drive",
  "gmail",
  "outlook",
  "onedrive",
  "dropbox",
  "box",
  "sharepoint",
]);

export function ConnectedSources() {
  const dispatch = useAppDispatch();
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [browsingConnector, setBrowsingConnector] = useState<{
    type: string;
    name: string;
  } | null>(null);

  // Fetch storage + communication definitions
  const {
    data: definitions = null,
    isLoading: defsLoading,
  } = useGetConnectorsByCategoryQuery({ categories: [...FILE_PROVIDER_CATEGORIES] });

  const {
    data: installedConnectors = null,
    isLoading: installedLoading,
    refetch: refetchInstalled,
  } = useGetInstalledConnectorsQuery();

  const [initializeOAuth] = useInitializeOAuthMutation();
  const [checkConnection] = useCheckConnectionMutation();

  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  // Filter to only show file/email providers
  const shownDefinitions = useMemo(() => {
    if (!definitions) return [];
    return (definitions as any[]).filter((d: any) => SHOWN_TYPES.has(d.type));
  }, [definitions]);

  // Build connected type set
  const connectedTypes = useMemo(() => {
    const set = new Set<string>();
    (installedConnectors as any[] | null)?.forEach((c: any) => {
      if (c.connector?.status === "connected") {
        set.add(c.definition?.type);
      }
    });
    return set;
  }, [installedConnectors]);

  // Sync to fileConnector Redux slice
  useEffect(() => {
    if (!shownDefinitions.length) return;
    const items: FileConnectorItem[] = shownDefinitions
      .filter((d: any) => CONNECTOR_META[d.type])
      .map((d: any) => ({
        appType: CONNECTOR_META[d.type]!.appType,
        type: CONNECTOR_META[d.type]!.connectorType,
        connected: connectedTypes.has(d.type),
        name: d.name,
        iconUrl: d.icon ?? undefined,
      }));
    dispatch(setFileConnectorList(items));
  }, [shownDefinitions, connectedTypes, dispatch]);

  // OAuth flow — identical to applications-page-client.tsx
  const checkConnectionWithRetries = useCallback(
    async (def: { type: string; name: string }) => {
      let connected = false;
      const delays = [1000, 3000, 5000];

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await checkConnection({ type: def.type }).unwrap();
          if (result.status === "connected") {
            toast.success(`${def.name} connected successfully!`);
            connected = true;
            break;
          }
          if (result.status === "error") {
            toast.error(`Failed to connect ${def.name}. Please try again.`);
            break;
          }
        } catch {
          // retry
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }

      if (!connected) {
        toast.info("Connection pending. Check Applications page for status.");
      }
    },
    [checkConnection]
  );

  const startOAuthFlow = useCallback(
    async (type: string, name: string) => {
      try {
        const data = await initializeOAuth({ type }).unwrap();
        const popup = window.open(data.authUrl, "oauth", "width=600,height=700,popup=true");
        if (!popup) {
          toast.error("Please allow popups for this site to connect apps.");
          setConnectingType(null);
          return;
        }

        const check = setInterval(async () => {
          if (popup.closed) {
            clearInterval(check);
            await checkConnectionWithRetries({ type, name });
            setConnectingType(null);
            refetchInstalled();
          }
        }, 500);
      } catch (error: any) {
        setConnectingType(null);
        toast.error(error?.message || "Failed to start connection");
      }
    },
    [checkConnectionWithRetries, refetchInstalled, initializeOAuth]
  );

  // Listen for postMessage from OAuth callback
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "composio-oauth-callback") {
        if (event.data.status === "failed") {
          toast.error("OAuth authorization was denied or failed.");
          setConnectingType(null);
        }
        refetchInstalled();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refetchInstalled]);

  const handleConnect = useCallback(
    (type: string, name: string) => {
      setConnectingType(type);
      startOAuthFlow(type, name);
    },
    [startOAuthFlow]
  );

  const handleBrowse = useCallback((type: string, name: string) => {
    setBrowsingConnector({ type, name });
  }, []);

  if (defsLoading || installedLoading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  if (!shownDefinitions.length) return null;

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {shownDefinitions.map((def: any) => {
          const isConnected = connectedTypes.has(def.type);
          const isConnecting = connectingType === def.type;

          return (
            <button
              key={def.id}
              type="button"
              onClick={() => {
                if (isConnected) {
                  handleBrowse(def.type, def.name);
                } else if (!isConnecting) {
                  handleConnect(def.type, def.name);
                }
              }}
              disabled={isConnecting}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                isConnected
                  ? "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                isConnecting && "opacity-50 cursor-wait"
              )}
            >
              {def.icon ? (
                <img
                  src={def.icon}
                  alt=""
                  className="size-4 rounded-sm object-contain"
                />
              ) : null}
              <span className="whitespace-nowrap">{def.name}</span>
              {isConnecting ? (
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <CheckCircleIcon className="size-3.5 text-primary" />
              ) : (
                <PlusIcon className="size-3.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Cloud File Browser Sheet */}
      {browsingConnector && (
        <CloudFileBrowser
          connectorType={browsingConnector.type}
          connectorName={browsingConnector.name}
          open={!!browsingConnector}
          onOpenChange={(open) => {
            if (!open) setBrowsingConnector(null);
          }}
        />
      )}
    </>
  );
}
