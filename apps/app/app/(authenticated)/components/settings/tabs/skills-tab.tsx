"use client";

import { useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  SparklesIcon,
  CodeIcon,
  GlobeIcon,
  FileTextIcon,
  ImageIcon,
  SearchIcon,
  TerminalIcon,
  DatabaseIcon,
  BrainIcon,
  MessageSquareIcon,
  BarChartIcon,
  CalendarIcon,
  LockIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";

// Skill definitions
const skills = [
  {
    id: "web_browsing",
    name: "Web Browsing",
    description: "Search the web and extract information from websites",
    icon: GlobeIcon,
    category: "research",
    enabled: true,
    isPremium: false,
  },
  {
    id: "code_execution",
    name: "Code Execution",
    description: "Write and execute code in multiple languages",
    icon: CodeIcon,
    category: "development",
    enabled: true,
    isPremium: false,
  },
  {
    id: "file_operations",
    name: "File Operations",
    description: "Read, write, and manage files on your devices",
    icon: FileTextIcon,
    category: "productivity",
    enabled: true,
    isPremium: false,
  },
  {
    id: "image_generation",
    name: "Image Generation",
    description: "Generate images using AI models",
    icon: ImageIcon,
    category: "creative",
    enabled: false,
    isPremium: true,
  },
  {
    id: "deep_research",
    name: "Deep Research",
    description: "Comprehensive research with multiple sources",
    icon: SearchIcon,
    category: "research",
    enabled: true,
    isPremium: false,
  },
  {
    id: "terminal_access",
    name: "Terminal Access",
    description: "Execute shell commands on connected devices",
    icon: TerminalIcon,
    category: "development",
    enabled: false,
    isPremium: false,
  },
  {
    id: "database_queries",
    name: "Database Queries",
    description: "Query and manage connected databases",
    icon: DatabaseIcon,
    category: "development",
    enabled: false,
    isPremium: true,
  },
  {
    id: "advanced_reasoning",
    name: "Advanced Reasoning",
    description: "Complex multi-step reasoning and analysis",
    icon: BrainIcon,
    category: "analysis",
    enabled: true,
    isPremium: false,
  },
  {
    id: "conversation_memory",
    name: "Conversation Memory",
    description: "Remember context from previous conversations",
    icon: MessageSquareIcon,
    category: "productivity",
    enabled: true,
    isPremium: false,
  },
  {
    id: "data_analysis",
    name: "Data Analysis",
    description: "Analyze data and create visualizations",
    icon: BarChartIcon,
    category: "analysis",
    enabled: true,
    isPremium: false,
  },
  {
    id: "scheduling",
    name: "Task Scheduling",
    description: "Schedule tasks to run automatically",
    icon: CalendarIcon,
    category: "productivity",
    enabled: true,
    isPremium: false,
  },
];

const categories = [
  { id: "all", label: "All Skills" },
  { id: "research", label: "Research" },
  { id: "development", label: "Development" },
  { id: "productivity", label: "Productivity" },
  { id: "creative", label: "Creative" },
  { id: "analysis", label: "Analysis" },
];

export function SkillsTab() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [skillStates, setSkillStates] = useState<Record<string, boolean>>(
    Object.fromEntries(skills.map((s) => [s.id, s.enabled]))
  );

  const filteredSkills =
    selectedCategory === "all"
      ? skills
      : skills.filter((s) => s.category === selectedCategory);

  const handleToggleSkill = (skillId: string, isPremium: boolean) => {
    if (isPremium && !skillStates[skillId]) {
      toast.error("This skill requires a Pro subscription");
      return;
    }

    setSkillStates((prev) => ({
      ...prev,
      [skillId]: !prev[skillId],
    }));
    toast.success(
      `${skills.find((s) => s.id === skillId)?.name} ${
        !skillStates[skillId] ? "enabled" : "disabled"
      }`
    );
  };

  const enabledCount = Object.values(skillStates).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Skills</h2>
        <p className="text-sm text-muted-foreground">
          Configure which AI capabilities are available to Rubic.
        </p>
      </div>

      <Separator />

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <strong>{enabledCount}</strong> of {skills.length} skills enabled
          </span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSkills.map((skill) => {
          const Icon = skill.icon;
          const isEnabled = skillStates[skill.id];

          return (
            <Card
              key={skill.id}
              className={cn(
                "transition-colors",
                isEnabled && "border-primary/50 bg-primary/5"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isEnabled ? "bg-primary/10" : "bg-muted"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isEnabled ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium">{skill.name}</h4>
                        {skill.isPremium && (
                          <Badge variant="secondary" className="text-xs">
                            <LockIcon className="h-3 w-3 mr-1" />
                            Pro
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() =>
                      handleToggleSkill(skill.id, skill.isPremium)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <SparklesIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium">About Skills</h4>
              <p className="text-xs text-muted-foreground">
                Skills determine what Rubic can do on your behalf. Disabling a skill
                will prevent Rubic from using that capability, even if requested.
                Some advanced skills require a Pro subscription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
