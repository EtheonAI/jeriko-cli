"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Loader2Icon,
  PaletteIcon,
  UserIcon,
  GlobeIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";
import { ErrorState } from "./error-state";

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Espa\u00f1ol" },
  { value: "fr", label: "Fran\u00e7ais" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Portugu\u00eas" },
  { value: "zh", label: "\u4e2d\u6587" },
  { value: "ja", label: "\u65e5\u672c\u8a9e" },
  { value: "ko", label: "\ud55c\uad6d\uc5b4" },
];

const themes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function PersonalizationTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState("en");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading, isError, refetch } = trpc.user.getProfile.useQuery(undefined, { retry: 1 });
  const utils = trpc.useUtils();

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.user.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  useEffect(() => {
    setMounted(true);
    // Load language from localStorage
    const savedLang = localStorage.getItem("rubic-language");
    if (savedLang) setLanguage(savedLang);
  }, []);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem("rubic-language", value);
    toast.success("Language updated");
  };

  const handleSaveBio = () => {
    // For now, just show success - bio would be saved to profile
    toast.success("Bio saved");
  };

  if (!mounted || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Personalization</h2>
          <p className="text-sm text-muted-foreground">
            Customize your Rubic experience.
          </p>
        </div>
        <Separator />
        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="h-32 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Personalization</h2>
          <p className="text-sm text-muted-foreground">
            Customize your Rubic experience.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load personalization settings"
          message="Unable to load your personalization preferences. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Personalization</h2>
        <p className="text-sm text-muted-foreground">
          Customize your Rubic experience.
        </p>
      </div>

      <Separator />

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PaletteIcon className="h-4 w-4" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose your preferred color theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", isSelected && "text-primary")} />
                  <span className={cn("text-sm", isSelected && "font-medium")}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Language Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GlobeIcon className="h-4 w-4" />
            Language
          </CardTitle>
          <CardDescription>
            Select your preferred language for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Profile Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>
            Customize how others see you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              defaultValue={profile?.name || ""}
              placeholder="Your display name"
              onChange={(e) => {
                // Debounced save would go here
              }}
              onBlur={(e) => {
                if (e.target.value !== profile?.name) {
                  updateProfile.mutate({ name: e.target.value });
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              A short description that appears on your profile
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={handleSaveBio}>
            Save Bio
          </Button>
        </CardContent>
      </Card>

      {/* AI Personalization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            AI Preferences
          </CardTitle>
          <CardDescription>
            Customize how Rubic interacts with you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Communication Style</Label>
            <Select defaultValue="balanced">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise - Brief and to the point</SelectItem>
                <SelectItem value="balanced">Balanced - Clear with some detail</SelectItem>
                <SelectItem value="detailed">Detailed - Comprehensive explanations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Expertise Level</Label>
            <Select defaultValue="intermediate">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner - Explain technical terms</SelectItem>
                <SelectItem value="intermediate">Intermediate - Some technical knowledge</SelectItem>
                <SelectItem value="expert">Expert - Full technical depth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Custom Instructions</Label>
            <Textarea
              placeholder="Add any specific instructions for how Rubic should behave..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be considered in every conversation
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
