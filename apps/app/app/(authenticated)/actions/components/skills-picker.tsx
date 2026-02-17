"use client";

import { useState } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  GlobeIcon,
  CodeIcon,
  ImageIcon,
  FileTextIcon,
  BarChart3Icon,
  MonitorIcon,
  ChevronDownIcon,
  CheckIcon,
} from "lucide-react";

const SKILLS = [
  {
    id: "web-search",
    label: "Web Search",
    icon: GlobeIcon,
  },
  {
    id: "code-interpreter",
    label: "Code Interpreter",
    icon: CodeIcon,
  },
  {
    id: "image-generation",
    label: "Image Generation",
    icon: ImageIcon,
  },
  {
    id: "document-analysis",
    label: "Document Analysis",
    icon: FileTextIcon,
  },
  {
    id: "data-analysis",
    label: "Data Analysis",
    icon: BarChart3Icon,
  },
  {
    id: "browser",
    label: "Browser",
    icon: MonitorIcon,
  },
] as const;

interface SkillsPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function SkillsPicker({ selected, onChange }: SkillsPickerProps) {
  const [expanded, setExpanded] = useState(false);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
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
        Skills (optional)
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
        <div className="grid grid-cols-2 gap-2" data-testid="skills-picker-grid">
          {SKILLS.map((skill) => {
            const Icon = skill.icon;
            const isSelected = selected.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggle(skill.id)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{skill.label}</span>
                {isSelected && <CheckIcon className="h-3.5 w-3.5 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
