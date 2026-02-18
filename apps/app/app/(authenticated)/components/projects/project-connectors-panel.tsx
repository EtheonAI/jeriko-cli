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
import { getTrpcClient } from "@/lib/trpc/vanilla";
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
  const [connectors, setConnectors] = useState<ProjectConnector[]>([]);
  const [definitions, setDefinitions] = useState<ConnectorDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const connectingTypeRef = useRef<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    try {
      const client = getTrpcClient();
      const data = await client.connectors.listForProject.query({ projectId });
      setConnectors(data as ProjectConnector[]);
    } catch {
      // Silent — non-critical
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchDefinitions = useCallback(async () => {
    try {
      const client = getTrpcClient();
      const data = await client.connectors.listDefinitions.query();
      setDefinitions(data as ConnectorDef[]);
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const connectedTypes = new Set(connectors.map((c) => c.definition.type));

  const handleConnect = useCallback(
    async (type: string) => {
      setConnectingType(type);
      connectingTypeRef.current = type;
      try {
        const client = getTrpcClient();
        const data = await client.connectors.initializeProjectOAuth.mutate({
          type,
          projectId,
        });

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
              const status = await client.connectors.checkProjectConnection.mutate({
                type: connectingTypeRef.current ?? type,
                projectId,
              });
              if (status.status === "connected") {
                toast.success(`${type} connected to project`);
              }
            } catch {
              // Silent
            }
            setConnectingType(null);
            fetchConnectors();
          }
        }, 500);
      } catch (error: any) {
        toast.error(error.message || "Failed to start OAuth");
        setConnectingType(null);
      }
    },
    [projectId, fetchConnectors]
  );

  const handleDisconnect = useCallback(
    async (connectorId: string) => {
      setDisconnectingId(connectorId);
      try {
        const client = getTrpcClient();
        await client.connectors.uninstall.mutate({ id: connectorId });
        toast.success("Connector removed from project");
        fetchConnectors();
      } catch (error: any) {
        toast.error(error.message || "Failed to disconnect");
      } finally {
        setDisconnectingId(null);
      }
    },
    [fetchConnectors]
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
        fetchConnectors();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchConnectors]);

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
              onClick={() => {
                if (definitions.length === 0) fetchDefinitions();
                setShowCatalog(true);
              }}
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
