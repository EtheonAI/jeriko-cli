"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
  WrenchIcon,
  GlobeIcon,
  CodeIcon,
  ImageIcon,
  FileSearchIcon,
  BarChart3Icon,
  MonitorIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import type { SkillId, SkillDefinition } from "./types";

interface SkillsButtonProps {
  activeSkills: SkillId[];
  onToggle: (skillId: SkillId) => void;
  disabled?: boolean;
}

const SKILLS: SkillDefinition[] = [
  {
    id: "web-search",
    label: "Web Search",
    description: "Search the internet for information",
    icon: "globe",
  },
  {
    id: "code-interpreter",
    label: "Code Interpreter",
    description: "Write and execute code",
    icon: "code",
  },
  {
    id: "image-generation",
    label: "Image Generation",
    description: "Generate images from descriptions",
    icon: "image",
  },
  {
    id: "document-analysis",
    label: "Document Analysis",
    description: "Analyze uploaded documents",
    icon: "file-search",
  },
  {
    id: "data-analysis",
    label: "Data Analysis",
    description: "Analyze data and create charts",
    icon: "bar-chart",
  },
  {
    id: "browser",
    label: "Browser",
    description: "Browse websites and interact",
    icon: "monitor",
  },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  globe: GlobeIcon,
  code: CodeIcon,
  image: ImageIcon,
  "file-search": FileSearchIcon,
  "bar-chart": BarChart3Icon,
  monitor: MonitorIcon,
};

export function SkillsButton({ activeSkills, onToggle, disabled }: SkillsButtonProps) {
  const activeCount = activeSkills.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 px-2 rounded-full text-xs gap-1",
            activeCount > 0
              ? "text-primary bg-primary/10 hover:bg-primary/15"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          <WrenchIcon className="size-3" />
          <span>Skills</span>
          {activeCount > 0 && (
            <span className="size-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-3">
        <p className="text-xs font-medium mb-3">Skills</p>
        <div className="space-y-3">
          {SKILLS.map((skill) => {
            const Icon = ICON_MAP[skill.icon] ?? WrenchIcon;
            const isActive = activeSkills.includes(skill.id);
            return (
              <div key={skill.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{skill.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {skill.description}
                    </p>
                  </div>
                </div>
                <Switch checked={isActive} onCheckedChange={() => onToggle(skill.id)} />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
