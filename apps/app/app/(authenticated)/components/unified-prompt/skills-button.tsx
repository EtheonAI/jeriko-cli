"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { PuzzleIcon, SearchIcon, Settings2Icon, WrenchIcon } from "lucide-react";
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
    label: "web-search",
    description:
      "Search the internet for real-time information, current events, and up-to-date data from across the web.",
    icon: "puzzle",
  },
  {
    id: "code-interpreter",
    label: "code-interpreter",
    description:
      "Write and execute code in a sandboxed environment for computation, data processing, and analysis tasks.",
    icon: "puzzle",
  },
  {
    id: "image-generation",
    label: "image-generation",
    description:
      "Generate images from text descriptions using AI image generation models for creative and design work.",
    icon: "puzzle",
  },
  {
    id: "document-analysis",
    label: "document-analysis",
    description:
      "Analyze uploaded documents, extract key information, summarize content, and answer questions about files.",
    icon: "puzzle",
  },
  {
    id: "data-analysis",
    label: "data-analysis",
    description:
      "Analyze datasets, create visualizations, generate statistical insights, and produce charts from data.",
    icon: "puzzle",
  },
  {
    id: "browser",
    label: "browser",
    description:
      "Browse websites, interact with web pages, fill forms, click elements, and extract information from the internet.",
    icon: "puzzle",
  },
];

export function SkillsButton({ activeSkills, onToggle, disabled }: SkillsButtonProps) {
  const activeCount = activeSkills.length;
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredSkills = useMemo(() => {
    if (!search) return SKILLS;
    const lower = search.toLowerCase();
    return SKILLS.filter(
      (s) => s.label.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower)
    );
  }, [search]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-[4px] p-[8px] cursor-pointer rounded-[100px] border border-[#e5e5e5] dark:border-[#333] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.08)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-[4px]">
            {activeCount > 0 && (
              <span
                className="flex items-center justify-center text-[10px] leading-[10px] h-[16px] min-w-[16px] px-[4px] bg-[#f0f0f0] dark:bg-[#333] rounded-full font-medium text-[#666] dark:text-[#999]"
              >
                +{activeCount}
              </span>
            )}
            <WrenchIcon
              className="text-[#666] dark:text-[#999]"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
          <span className="text-xs text-[#666] dark:text-[#999] whitespace-nowrap pr-1">
            Skills
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] p-0 rounded-xl border-[0.5px] border-[#e5e5e5] dark:border-[#333] shadow-[0_4px_11px_0px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_11px_0px_rgba(0,0,0,0.3)]"
      >
        {/* Search */}
        <div className="p-1 shrink-0">
          <div className="flex items-center gap-2 p-2">
            <SearchIcon
              className="text-[#999] dark:text-[#666] shrink-0"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              placeholder="Search Skills"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[#999] dark:placeholder:text-[#666] outline-none"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-3" />

        {/* Skills list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-1 max-h-[300px]">
          {filteredSkills.length === 0 ? (
            <p className="text-sm text-[#999] dark:text-[#666] text-center py-6">No skills found</p>
          ) : (
            filteredSkills.map((skill) => {
              const isActive = activeSkills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => onToggle(skill.id)}
                  className={cn(
                    "w-full py-[6px] rounded-lg px-2 text-left transition-colors cursor-pointer",
                    isActive ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <div className="size-5 flex items-center justify-center shrink-0">
                      <PuzzleIcon
                        className="text-foreground"
                        size={16}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {skill.label}
                    </span>
                    <span className="shrink-0 h-4 px-1 rounded bg-accent text-[11px] text-muted-foreground flex items-center">
                      Official
                    </span>
                  </div>
                  <div className="ps-6 mt-[2px]">
                    <div className="text-xs text-muted-foreground line-clamp-1 break-all">
                      {skill.description}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-3" />

        {/* Manage Skills footer */}
        <div className="p-1">
          <button
            type="button"
            className="flex items-center gap-2 p-2 rounded-lg w-full hover:bg-accent cursor-pointer transition-colors"
            onClick={() => router.push("/settings")}
          >
            <Settings2Icon
              className="text-foreground shrink-0"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-sm text-foreground">Manage Skills</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
