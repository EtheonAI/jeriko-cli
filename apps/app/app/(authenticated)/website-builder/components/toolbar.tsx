"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { ArrowLeftIcon, SparklesIcon, RocketIcon } from "lucide-react";

const frameworkLabels: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
};

interface ToolbarProps {
  projectName: string;
  framework: string;
  onBack: () => void;
  onGenerate: () => void;
  onDeploy: () => void;
}

export function Toolbar({ projectName, framework, onBack, onGenerate, onDeploy }: ToolbarProps) {
  return (
    <div className="flex h-12 items-center gap-3 border-b bg-background px-3">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
        <ArrowLeftIcon className="h-4 w-4" />
      </Button>

      <span className="text-sm font-medium">{projectName}</span>
      <Badge variant="outline" className="text-xs">
        {frameworkLabels[framework] ?? framework}
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onGenerate}>
          <SparklesIcon className="mr-2 h-3.5 w-3.5" />
          AI Generate
        </Button>
        <Button size="sm" onClick={onDeploy}>
          <RocketIcon className="mr-2 h-3.5 w-3.5" />
          Deploy
        </Button>
      </div>
    </div>
  );
}
