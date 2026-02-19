"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { CableIcon, Loader2Icon, PlusIcon, SettingsIcon } from "lucide-react";
import {
  useGetInstalledConnectorsQuery,
  useGetConnectorDefinitionsQuery,
} from "@/lib/store/api/api.slice";

// ============================================================================
// Types
// ============================================================================

export interface SelectedConnection {
  id: string;
  type: "app" | "device";
  name: string;
}

interface ConnectionsModalProps {
  disabled?: boolean;
  selectedConnections: SelectedConnection[];
  onToggleConnection: (connection: SelectedConnection) => void;
  onOpenDialog?: () => void;
}

// ============================================================================
// Popular apps to show for new users who haven't connected anything yet
// ============================================================================

const POPULAR_TYPES = [
  "gmail",
  "github",
  "slack",
  "notion",
  "google_calendar",
  "google_drive",
  "linear",
  "jira",
];

// ============================================================================
// Toggle Switch (Manus-style)
// ============================================================================

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        checked
          ? "bg-blue-500"
          : "bg-[#e5e5e5] dark:bg-[#444]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-[16px] rounded-full bg-white shadow-sm transition-transform duration-200",
          "translate-y-[2px]",
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ConnectionsModal({
  disabled,
  selectedConnections,
  onToggleConnection,
  onOpenDialog,
}: ConnectionsModalProps) {
  const router = useRouter();

  // Data fetching via RTK Query
  const { data: connectorsData, isLoading: loadingInstalledConnectors } = useGetInstalledConnectorsQuery();
  const { data: definitionsData, isLoading: loadingDefinitions } = useGetConnectorDefinitionsQuery();
  const connectors = (connectorsData as any[] | null) ?? null;
  const definitions = (definitionsData as any[] | null) ?? null;
  const loadingConnectors = loadingInstalledConnectors || loadingDefinitions;

  const isSelected = (id: string) => selectedConnections.some((c) => c.id === id);
  const selectedCount = selectedConnections.length;

  // Build display list: connected apps first, then popular unconnected apps for discovery
  const displayItems = useMemo(() => {
    const items: Array<{
      key: string;
      connectorId?: string;
      name: string;
      icon?: string | null;
      isConnected: boolean;
      isPending: boolean;
      isBeta?: boolean;
      defId?: string;
      defType?: string;
    }> = [];

    // 1. User's installed connectors (connected + pending)
    if (connectors) {
      for (const item of connectors) {
        const name = item.definition?.name ?? item.connector.connectorDefinitionId;
        items.push({
          key: `installed-${item.connector.id}`,
          connectorId: item.connector.id,
          name,
          icon: item.definition?.icon,
          isConnected: item.connector.status === "connected",
          isPending: item.connector.status === "pending",
          isBeta: item.definition?.isPremium,
          defId: item.definition?.id,
          defType: item.connector.connectorDefinitionId,
        });
      }
    }

    // 2. Popular uninstalled apps (for discovery)
    if (definitions) {
      const installedTypes = new Set(
        connectors?.map((c) => c.definition?.type).filter(Boolean) ?? []
      );
      for (const type of POPULAR_TYPES) {
        if (installedTypes.has(type)) continue;
        const def = definitions.find((d) => d.type === type);
        if (def) {
          items.push({
            key: `popular-${def.id}`,
            name: def.name,
            icon: def.icon,
            isConnected: false,
            isPending: false,
            isBeta: def.isPremium,
            defId: def.id,
            defType: def.type,
          });
        }
      }
    }

    return items;
  }, [connectors, definitions]);

  const handleToggle = useCallback(
    (item: (typeof displayItems)[number]) => {
      if (item.isConnected && item.connectorId) {
        onToggleConnection({
          id: item.connectorId,
          type: "app",
          name: item.name,
        });
      }
    },
    [onToggleConnection]
  );

  const handleConnect = useCallback(() => {
    // Open the full connectors dialog for OAuth / API key flow
    onOpenDialog?.();
  }, [onOpenDialog]);

  const isLoading = loadingConnectors;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-[4px] p-[8px]",
            "cursor-pointer rounded-[100px]",
            "border border-[#e5e5e5] dark:border-[#333]",
            "hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.08)]",
            "transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-[4px]">
            {selectedCount > 0 && (
              <span
                className={cn(
                  "flex items-center justify-center",
                  "text-[10px] leading-[10px]",
                  "h-[16px] min-w-[16px] px-[4px]",
                  "bg-[#f0f0f0] dark:bg-[#333]",
                  "rounded-full font-medium",
                  "text-[#666] dark:text-[#999]"
                )}
              >
                +{selectedCount}
              </span>
            )}
            <CableIcon
              className="text-[#666] dark:text-[#999]"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
          <span className="text-xs text-[#666] dark:text-[#999] whitespace-nowrap pr-1">
            Connectors
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-[0.5px] border-[#e5e5e5] dark:border-[#333] shadow-[0_4px_11px_0px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_11px_0px_rgba(0,0,0,0.3)]"
      >
        {/* Connector list */}
        <div className="overflow-y-auto p-[4px]" style={{ maxHeight: 320 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex items-center justify-center py-6 px-4">
              <p className="text-sm text-muted-foreground text-center">
                No connectors available
              </p>
            </div>
          ) : (
            displayItems.map((item) => {
              const selected = item.connectorId ? isSelected(item.connectorId) : false;

              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (item.isConnected) handleToggle(item);
                    else if (!item.isPending) handleConnect();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (item.isConnected) handleToggle(item);
                      else if (!item.isPending) handleConnect();
                    }
                  }}
                  className="flex items-center justify-between px-[8px] h-[36px] rounded-[8px] select-none cursor-pointer hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  {/* Icon + Name */}
                  <div className="flex items-center gap-[8px] overflow-hidden flex-1 min-w-0">
                    <div className="size-[24px] rounded-[4px] flex items-center justify-center flex-shrink-0">
                      {item.icon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={item.name}
                          src={item.icon}
                          className="w-[16px] h-[16px]"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <CableIcon className="text-muted-foreground" size={16} />
                      )}
                    </div>
                    <span className="text-foreground text-[13px] leading-[20px] truncate" title={item.name}>
                      {item.name}
                    </span>
                    {item.isBeta && (
                      <span className="shrink-0 text-[10px] font-medium leading-[14px] text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded">
                        Beta
                      </span>
                    )}
                  </div>

                  {/* Right side: toggle switch or connect button */}
                  <div className="shrink-0 ml-2">
                    {item.isConnected ? (
                      <ToggleSwitch
                        checked={selected}
                        onChange={() => handleToggle(item)}
                      />
                    ) : item.isPending ? (
                      <span className="text-[11px] font-medium text-amber-500">
                        Pending
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-blue-500">
                        Connect
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Add connectors + Manage connectors */}
        <div className="border-t border-border py-[4px] px-[4px]">
          {/* Add connectors */}
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-[8px] px-[8px] h-[36px] rounded-[8px] hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => onOpenDialog?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDialog?.();
              }
            }}
          >
            <PlusIcon className="text-muted-foreground shrink-0" size={16} strokeWidth={2} />
            <span className="text-[13px] text-foreground">Add connectors</span>
          </div>

          {/* Manage connectors */}
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-[8px] px-[8px] h-[36px] rounded-[8px] hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => router.push("/applications#settings/connectors")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push("/applications#settings/connectors");
              }
            }}
          >
            <SettingsIcon className="text-muted-foreground shrink-0" size={16} strokeWidth={2} />
            <span className="text-[13px] text-foreground">Manage connectors</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
