"use client";

import { useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
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
  RotateCcwIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";
import { ErrorState } from "./error-state";

// Skill definitions
const skills = [
  {
    id: "web_browsing",
    name: "Web Browsing",
    description: "Search the web and extract information from websites",
    icon: GlobeIcon,
    category: "research",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "code_execution",
    name: "Code Execution",
    description: "Write and execute code in multiple languages",
    icon: CodeIcon,
    category: "development",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "file_operations",
    name: "File Operations",
    description: "Read, write, and manage files on your devices",
    icon: FileTextIcon,
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "image_generation",
    name: "Image Generation",
    description: "Generate images using AI models",
    icon: ImageIcon,
    category: "creative",
    defaultEnabled: false,
    isPremium: true,
  },
  {
    id: "deep_research",
    name: "Deep Research",
    description: "Comprehensive research with multiple sources",
    icon: SearchIcon,
    category: "research",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "terminal_access",
    name: "Terminal Access",
    description: "Execute shell commands on connected devices",
    icon: TerminalIcon,
    category: "development",
    defaultEnabled: false,
    isPremium: false,
  },
  {
    id: "database_queries",
    name: "Database Queries",
    description: "Query and manage connected databases",
    icon: DatabaseIcon,
    category: "development",
    defaultEnabled: false,
    isPremium: true,
  },
  {
    id: "advanced_reasoning",
    name: "Advanced Reasoning",
    description: "Complex multi-step reasoning and analysis",
    icon: BrainIcon,
    category: "analysis",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "conversation_memory",
    name: "Conversation Memory",
    description: "Remember context from previous conversations",
    icon: MessageSquareIcon,
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "data_analysis",
    name: "Data Analysis",
    description: "Analyze data and create visualizations",
    icon: BarChartIcon,
    category: "analysis",
    defaultEnabled: true,
    isPremium: false,
  },
  {
    id: "scheduling",
    name: "Task Scheduling",
    description: "Schedule tasks to run automatically",
    icon: CalendarIcon,
    category: "productivity",
    defaultEnabled: true,
    isPremium: false,
  },
];

const defaultSkillStates = Object.fromEntries(skills.map((s) => [s.id, s.defaultEnabled]));

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

  const {
    data: preferences,
    isLoading: prefsLoading,
    isError: prefsError,
    refetch: refetchPrefs,
  } = trpc.user.getPreferences.useQuery(undefined, { retry: 1 });
  const { data: subscription } = trpc.billing.getSubscription.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const updatePreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      utils.user.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update skill settings");
    },
  });

  const skillStates = preferences?.enabledSkills ?? defaultSkillStates;
  const isPro = subscription?.plan?.type === "pro" || subscription?.plan?.type === "enterprise";

  const filteredSkills =
    selectedCategory === "all" ? skills : skills.filter((s) => s.category === selectedCategory);

  const handleToggleSkill = (skillId: string, isPremium: boolean) => {
    const currentState =
      skillStates[skillId] ?? skills.find((s) => s.id === skillId)?.defaultEnabled ?? false;

    if (isPremium && !currentState && !isPro) {
      toast.error("This skill requires a Pro subscription");
      return;
    }

    const newSkillStates = {
      ...skillStates,
      [skillId]: !currentState,
    };

    updatePreferences.mutate({ enabledSkills: newSkillStates });

    const skillName = skills.find((s) => s.id === skillId)?.name;
    toast.success(`${skillName} ${!currentState ? "enabled" : "disabled"}`);
  };

  const handleResetDefaults = () => {
    updatePreferences.mutate({ enabledSkills: defaultSkillStates });
    toast.success("Skills reset to defaults");
  };

  const enabledCount = Object.values(skillStates).filter(Boolean).length;

  if (prefsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          <p className="text-sm text-muted-foreground">
            Configure which AI capabilities are available to Rubic.
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (prefsError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          <p className="text-sm text-muted-foreground">
            Configure which AI capabilities are available to Rubic.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load skills"
          message="Unable to load your skill preferences. Please try again."
          onRetry={() => refetchPrefs()}
        />
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <strong>{enabledCount}</strong> of {skills.length} skills enabled
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetDefaults} className="gap-2">
          <RotateCcwIcon className="h-3 w-3" />
          Reset to defaults
        </Button>
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
          const isEnabled = skillStates[skill.id] ?? skill.defaultEnabled;

          return (
            <Card
              key={skill.id}
              className={cn("transition-colors", isEnabled && "border-primary/50 bg-primary/5")}
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
                      <p className="text-xs text-muted-foreground">{skill.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggleSkill(skill.id, skill.isPremium)}
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
                Skills determine what Rubic can do on your behalf. Disabling a skill will prevent
                Rubic from using that capability, even if requested. Some advanced skills require a
                Pro subscription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
