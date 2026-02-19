"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Loader2Icon,
  PlusIcon,
  LinkIcon,
  UnlinkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  useGetProjectConnectorsQuery,
  useGetConnectorDefinitionsQuery,
  useInitializeProjectOAuthMutation,
  useCheckProjectConnectionMutation,
  useUninstallConnectorMutation,
} from "@/lib/store/api/api.slice";
import { toast } from "sonner";

type ConnectorDef = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  authType: string;
};

type ProjectConnector = {
  connector: {
    id: string;
    status: string;
    connectorDefinitionId: string;
    projectId: string | null;
  };
  definition: ConnectorDef;
};

type ProjectConnectorsPanelProps = {
  projectId: string;
};

export function ProjectConnectorsPanel({ projectId }: ProjectConnectorsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const connectingTypeRef = useRef<string | null>(null);

  // RTK Query for project connectors
  const { data: connectors = [], isLoading, refetch: refetchConnectors } = useGetProjectConnectorsQuery(
    { projectId },
    { selectFromResult: ({ data, ...rest }) => ({ data: data as ProjectConnector[] | undefined, ...rest }) }
  );

  // RTK Query for all definitions (lazy — fetched when catalog opens)
  const { data: definitions = [] } = useGetConnectorDefinitionsQuery(undefined, {
    skip: !showCatalog,
    selectFromResult: ({ data, ...rest }) => ({ data: data as ConnectorDef[] | undefined, ...rest }),
  });

  // RTK Query mutations
  const [initProjectOAuth] = useInitializeProjectOAuthMutation();
  const [checkConnection] = useCheckProjectConnectionMutation();
  const [uninstallConnector] = useUninstallConnectorMutation();

  const connectedTypes = new Set(connectors.map((c) => c.definition.type));

  const handleConnect = useCallback(
    async (type: string) => {
      setConnectingType(type);
      connectingTypeRef.current = type;
      try {
        const data = await initProjectOAuth({ type, projectId }).unwrap() as any;

        const popup = window.open(data.authUrl, "oauth", "width=600,height=700,popup=true");
        if (!popup) {
          toast.error("Please allow popups for this site to connect apps.");
          setConnectingType(null);
          return;
        }

        // Poll for popup close → check connection status
        const check = setInterval(async () => {
          if (popup.closed) {
            clearInterval(check);
            try {
              const status = await checkConnection({
                type: connectingTypeRef.current ?? type,
                projectId,
              }).unwrap() as any;
              if (status.status === "connected") {
                toast.success(`${type} connected to project`);
              }
            } catch {
              // Silent
            }
            setConnectingType(null);
            refetchConnectors();
          }
        }, 500);
      } catch (error: any) {
        toast.error(error.message || "Failed to start OAuth");
        setConnectingType(null);
      }
    },
    [projectId, initProjectOAuth, checkConnection, refetchConnectors]
  );

  const handleDisconnect = useCallback(
    async (connectorId: string) => {
      setDisconnectingId(connectorId);
      try {
        await uninstallConnector(connectorId).unwrap();
        toast.success("Connector removed from project");
        refetchConnectors();
      } catch (error: any) {
        toast.error(error.message || "Failed to disconnect");
      } finally {
        setDisconnectingId(null);
      }
    },
    [uninstallConnector, refetchConnectors]
  );

  // Listen for postMessage from OAuth callback popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "composio-oauth-callback") {
        if (event.data.status === "failed") {
          toast.error("OAuth authorization was denied or failed.");
          setConnectingType(null);
        }
        refetchConnectors();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refetchConnectors]);

  const connectedCount = connectors.filter(
    (c) => c.connector.status === "connected"
  ).length;

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" />
          Project Connectors
          {connectedCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {connectedCount}
            </Badge>
          )}
        </span>
        {isExpanded ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : connectors.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No connectors added to this project yet. Project connectors are
              isolated from your personal connections.
            </p>
          ) : (
            <div className="space-y-1.5">
              {connectors.map((c) => (
                <div
                  key={c.connector.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-muted/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.definition.icon ? (
                      <img
                        src={c.definition.icon}
                        alt=""
                        className="size-5 rounded"
                      />
                    ) : (
                      <LinkIcon className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm truncate">{c.definition.name}</span>
                    <Badge
                      variant={
                        c.connector.status === "connected"
                          ? "default"
                          : c.connector.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {c.connector.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleDisconnect(c.connector.id)}
                    disabled={disconnectingId === c.connector.id}
                  >
                    {disconnectingId === c.connector.id ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <UnlinkIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add connector button / catalog */}
          {!showCatalog ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowCatalog(true)}
            >
              <PlusIcon className="size-4 mr-1.5" />
              Add connector
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Available connectors
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowCatalog(false)}
                >
                  Close
                </Button>
              </div>
              <div className="max-h-[240px] overflow-y-auto space-y-1">
                {definitions
                  .filter((d) => d.authType === "oauth2" && !connectedTypes.has(d.type))
                  .map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      disabled={connectingType === def.type}
                      onClick={() => handleConnect(def.type)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                    >
                      {def.icon ? (
                        <img src={def.icon} alt="" className="size-5 rounded" />
                      ) : (
                        <LinkIcon className="size-4 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{def.name}</p>
                      </div>
                      {connectingType === def.type && (
                        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
