"use client";

import { useState, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  SearchIcon,
  RefreshCwIcon,
  MonitorIcon,
  SmartphoneIcon,
  ServerIcon,
  GlobeIcon,
  HomeIcon,
  CpuIcon,
  CloudIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  LinkIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@repo/design-system/lib/utils";
import type { DeviceDefinition } from "@repo/database";

const categories = [
  { value: "all", label: "All" },
  { value: "computer", label: "Computers" },
  { value: "mobile", label: "Mobile" },
  { value: "server", label: "Servers" },
  { value: "browser", label: "Browsers" },
  { value: "smart_home", label: "Smart Home" },
  { value: "cloud", label: "Cloud" },
  { value: "iot", label: "IoT" },
] as const;

type CategoryValue = (typeof categories)[number]["value"];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  computer: MonitorIcon,
  mobile: SmartphoneIcon,
  server: ServerIcon,
  browser: GlobeIcon,
  smart_home: HomeIcon,
  iot: CpuIcon,
  cloud: CloudIcon,
};

const categoryColors: Record<string, string> = {
  computer: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mobile: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  server: "bg-green-500/10 text-green-600 dark:text-green-400",
  browser: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  smart_home: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  iot: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  cloud: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

export function DeviceCatalogTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryValue>("all");
  const [selectedDevice, setSelectedDevice] = useState<DeviceDefinition | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: definitions,
    isLoading,
    isError,
    refetch,
  } = trpc.devices.listDefinitions.useQuery(undefined, { retry: 1 });

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    definitions?.forEach((d) => {
      const cat = d.category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [definitions]);

  // Filtered definitions
  const filtered = useMemo(() => {
    if (!definitions) return [];
    const searchLower = search.toLowerCase();
    return definitions.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (
        search &&
        !d.name.toLowerCase().includes(searchLower) &&
        !d.description?.toLowerCase().includes(searchLower) &&
        !d.platform?.toLowerCase().includes(searchLower)
      )
        return false;
      return true;
    });
  }, [definitions, category, search]);

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground mb-4">Failed to load device catalog.</p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCwIcon className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const count =
            cat.value === "all" ? (definitions?.length ?? 0) : (categoryCounts[cat.value] ?? 0);
          const isActive = category === cat.value;

          if (cat.value !== "all" && count === 0) return null;

          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.label}
              <span
                className={cn(
                  "ml-0.5 text-[10px]",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((def) => {
            const CatIcon = categoryIcons[def.category] ?? MonitorIcon;
            const catColor = categoryColors[def.category] ?? categoryColors.computer;

            return (
              <button
                key={def.id}
                type="button"
                onClick={() => setSelectedDevice(def)}
                className="group relative flex flex-col rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {def.icon ? (
                      <img
                        src={def.icon}
                        alt={def.name}
                        className="h-6 w-6 rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <CatIcon className={`h-5 w-5 ${def.icon ? "hidden" : ""}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{def.name}</span>
                      {def.isPremium && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Pro
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                      >
                        {def.category.replace("_", " ")}
                      </span>
                      {def.platform && (
                        <span className="text-[10px] text-muted-foreground">{def.platform}</span>
                      )}
                    </div>
                  </div>
                </div>
                {def.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {def.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <MonitorIcon className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? "No devices match your search" : "No devices available"}
          </p>
          {search && (
            <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-3">
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Device Detail Dialog */}
      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        {selectedDevice && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedDevice.name}
                {selectedDevice.isPremium && (
                  <Badge variant="secondary" className="text-xs">
                    Pro
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>{selectedDevice.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Platform & Category */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {selectedDevice.category.replace("_", " ")}
                </Badge>
                {selectedDevice.platform && (
                  <Badge variant="outline" className="text-xs">
                    {selectedDevice.platform}
                  </Badge>
                )}
              </div>

              {/* Capabilities */}
              {selectedDevice.capabilities &&
                (selectedDevice.capabilities as string[]).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {(selectedDevice.capabilities as string[]).map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Requirements */}
              {selectedDevice.requirements &&
                (selectedDevice.requirements as string[]).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Requirements</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {(selectedDevice.requirements as string[]).map((req) => (
                        <li key={req} className="flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Install Command */}
              {selectedDevice.agentCommand && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Install Agent</p>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                    <code className="flex-1 text-xs break-all">{selectedDevice.agentCommand}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopyCommand(selectedDevice.agentCommand!)}
                    >
                      {copied ? (
                        <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Setup Instructions */}
              {selectedDevice.setupInstructions && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Setup</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {selectedDevice.setupInstructions}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
