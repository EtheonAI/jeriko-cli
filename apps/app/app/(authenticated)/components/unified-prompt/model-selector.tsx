"use client";

import { useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { BUILT_IN_MODELS } from "@repo/ai/lib/providers/provider-registry";
import { ChevronDownIcon, CheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const currentModel = useMemo(() => BUILT_IN_MODELS.find((m) => m.id === value), [value]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof BUILT_IN_MODELS> = {};
    for (const model of BUILT_IN_MODELS) {
      const key = model.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(model);
    }
    return groups;
  }, []);

  const providerOrder = ["anthropic", "openai", "google"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 px-2 rounded-full text-xs text-muted-foreground hover:bg-accent gap-1"
        >
          <SparklesIcon className="size-3" />
          <span className="max-w-[100px] truncate">{currentModel?.name ?? "Model"}</span>
          <ChevronDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-2xl p-1.5">
        {providerOrder.map((provider, idx) => {
          const models = groupedModels[provider];
          if (!models?.length) return null;
          return (
            <div key={provider}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                {PROVIDER_LABELS[provider] ?? provider}
              </DropdownMenuLabel>
              <DropdownMenuGroup className="space-y-0.5">
                {models.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    className={cn(
                      "rounded-xl text-xs gap-2 justify-between",
                      model.id === value && "bg-accent"
                    )}
                    onClick={() => onChange(model.id)}
                  >
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      {model.description && (
                        <span className="text-[10px] text-muted-foreground">
                          {model.description}
                        </span>
                      )}
                    </div>
                    {model.id === value && <CheckIcon className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
