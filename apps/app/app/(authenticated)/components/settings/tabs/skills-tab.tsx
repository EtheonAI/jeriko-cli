"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Switch } from "@repo/design-system/components/ui/switch";
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
  type LucideIcon,
} from "lucide-react";
import {
  useGetUserPreferencesQuery,
  useGetSubscriptionQuery,
  useUpdatePreferencesMutation,
  useGetSkillDefinitionsQuery,
} from "@/lib/store/api/api.slice";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  setOfficialSkills,
  toggleSkillEnabled,
  type Skill as ReduxSkill,
} from "@/lib/store/slices/skills.slice";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";
import { ErrorState } from "./error-state";

// Icon string → lucide component mapping
const ICON_MAP: Record<string, LucideIcon> = {
  globe: GlobeIcon,
  code: CodeIcon,
  "file-text": FileTextIcon,
  image: ImageIcon,
  search: SearchIcon,
  terminal: TerminalIcon,
  database: DatabaseIcon,
  brain: BrainIcon,
  "message-square": MessageSquareIcon,
  "bar-chart": BarChartIcon,
  calendar: CalendarIcon,
};

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
  const dispatch = useAppDispatch();

  // Fetch skill definitions from DB
  const {
    data: skillDefinitions,
    isLoading: skillsLoading,
    isError: skillsError,
    refetch: refetchSkills,
  } = useGetSkillDefinitionsQuery();

  const { data: rawPreferences, isLoading: prefsLoading, isError: prefsError, refetch: refetchPreferences } = useGetUserPreferencesQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({ data: data as { enabledSkills?: Record<string, boolean> } | undefined, ...rest }),
  });
  const preferences = rawPreferences ?? null;
  const [updatePreferencesMutation] = useUpdatePreferencesMutation();

  const { data: subscriptionData } = useGetSubscriptionQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({
      data: data as { subscription: { plan?: string } | null } | null | undefined,
      ...rest,
    }),
  });
  const reduxSubscription = subscriptionData?.subscription ?? null;

  // Build default skill states from API data
  const defaultSkillStates = useMemo(() => {
    if (!skillDefinitions) return {};
    return Object.fromEntries(skillDefinitions.map((s) => [s.type, s.defaultEnabled]));
  }, [skillDefinitions]);

  // Sync skill definitions + enabled state to Redux skills slice
  useEffect(() => {
    if (!preferences || !skillDefinitions) return;
    const enabledSkills = preferences.enabledSkills ?? defaultSkillStates;
    const reduxSkills: ReduxSkill[] = skillDefinitions.map((s) => ({
      id: s.type,
      uid: s.type,
      name: s.name,
      description: s.description ?? "",
      prompt: "",
      iconUrl: "",
      category: s.category,
      isOfficial: true,
      isEnabled: enabledSkills[s.type] ?? s.defaultEnabled,
      usageCount: 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    dispatch(setOfficialSkills(reduxSkills));
  }, [preferences, skillDefinitions, defaultSkillStates, dispatch]);

  const updatePreferences = useCallback(
    async (newPrefs: { enabledSkills: Record<string, boolean> }) => {
      try {
        await updatePreferencesMutation(newPrefs).unwrap();
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to update skill settings");
      }
    },
    [updatePreferencesMutation]
  );

  const skillStates = preferences?.enabledSkills ?? defaultSkillStates;
  const isPro = reduxSubscription?.plan === "pro" || reduxSubscription?.plan === "enterprise";

  const skills = skillDefinitions ?? [];
  const filteredSkills =
    selectedCategory === "all" ? skills : skills.filter((s) => s.category === selectedCategory);

  const handleToggleSkill = (skillType: string, isPremium: boolean) => {
    const skill = skills.find((s) => s.type === skillType);
    const currentState = skillStates[skillType] ?? skill?.defaultEnabled ?? false;

    if (isPremium && !currentState && !isPro) {
      toast.error("This skill requires a Pro subscription");
      return;
    }

    const newSkillStates = {
      ...skillStates,
      [skillType]: !currentState,
    };

    updatePreferences({ enabledSkills: newSkillStates });

    // Optimistically update Redux skills slice
    dispatch(toggleSkillEnabled({ id: skillType, isOfficial: true }));

    toast.success(`${skill?.name} ${!currentState ? "enabled" : "disabled"}`);
  };

  const handleResetDefaults = () => {
    updatePreferences({ enabledSkills: defaultSkillStates });
    // Re-sync Redux with default skill states
    if (skillDefinitions) {
      const reduxSkills: ReduxSkill[] = skillDefinitions.map((s) => ({
        id: s.type,
        uid: s.type,
        name: s.name,
        description: s.description ?? "",
        prompt: "",
        iconUrl: "",
        category: s.category,
        isOfficial: true,
        isEnabled: s.defaultEnabled,
        usageCount: 0,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
      dispatch(setOfficialSkills(reduxSkills));
    }
    toast.success("Skills reset to defaults");
  };

  const enabledCount = Object.values(skillStates).filter(Boolean).length;

  if (skillsLoading || prefsLoading) {
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

  if (skillsError || prefsError) {
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
          onRetry={() => {
            refetchSkills();
            refetchPreferences();
          }}
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
          const Icon = ICON_MAP[skill.icon ?? ""] ?? SparklesIcon;
          const isEnabled = skillStates[skill.type] ?? skill.defaultEnabled;

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
                    onCheckedChange={() => handleToggleSkill(skill.type, skill.isPremium)}
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
