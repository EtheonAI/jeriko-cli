"use client";

import { useState, useMemo } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ChevronDownIcon, CheckIcon, PlugIcon, Loader2Icon } from "lucide-react";
import { useGetInstalledConnectorsQuery } from "@/lib/store/api/api.slice";

interface InstalledConnector {
  connector: { id: string; connectorDefinitionId: string; status: string };
  definition: { id: string; type: string; name: string; icon: string | null };
}

interface ConnectorPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ConnectorPicker({ selected, onChange }: ConnectorPickerProps) {
  const [expanded, setExpanded] = useState(false);

  // RTK Query — only fetch when expanded (skip otherwise)
  const { data: installedData, isLoading: loading } = useGetInstalledConnectorsQuery(undefined, {
    skip: !expanded,
  });

  // Only show connected apps
  const connectors = useMemo(() => {
    if (!installedData) return [];
    return (installedData as InstalledConnector[]).filter(
      (c) => c.connector.status === "connected",
    );
  }, [installedData]);

  function toggle(type: string) {
    if (selected.includes(type)) {
      onChange(selected.filter((s) => s !== type));
    } else {
      onChange([...selected, type]);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 px-2 text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        <PlugIcon className="h-3.5 w-3.5" />
        Connectors (optional)
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
            {selected.length}
          </Badge>
        )}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </Button>

      {expanded && (
        <div data-testid="connector-picker-grid">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading connected apps...
            </div>
          )}

          {!loading && connectors.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No connected apps. Connect apps in the Applications page first.
            </p>
          )}

          {!loading && connectors.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {connectors.map((c) => {
                const isSelected = selected.includes(c.definition.type);
                return (
                  <button
                    key={c.definition.type}
                    type="button"
                    onClick={() => toggle(c.definition.type)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {c.definition.icon ? (
                      <img
                        src={c.definition.icon}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded-sm"
                      />
                    ) : (
                      <PlugIcon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{c.definition.name}</span>
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
