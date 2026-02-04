"use client";

import { useEffect, useState } from "react";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon, Loader2Icon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { ErrorState } from "./error-state";

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
];

const themes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function SettingsTab() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState("en");

  // Fetch notification preferences
  const { data: preferences, isLoading, isError, error, refetch } = trpc.notifications.getPreferences.useQuery(
    undefined,
    {
      retry: 1,
      retryDelay: 1000,
    }
  );

  // Update preferences mutation
  const utils = trpc.useUtils();
  const updatePreferences = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update preferences");
    },
  });

  // Local state for switches (optimistic updates)
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [inAppSound, setInAppSound] = useState(true);

  // Sync local state with server data
  useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.emailEnabled ?? true);
      setPushEnabled(preferences.pushEnabled ?? true);
      setInAppEnabled(preferences.inAppEnabled ?? true);
      setInAppSound(preferences.inAppSound ?? true);
    }
  }, [preferences]);

  const handleToggle = (
    field: "emailEnabled" | "pushEnabled" | "inAppEnabled" | "inAppSound",
    value: boolean,
    setState: (value: boolean) => void
  ) => {
    // Optimistic update
    setState(value);

    // Update server
    updatePreferences.mutate(
      { [field]: value },
      {
        onError: () => {
          // Revert on error
          setState(!value);
        },
      }
    );
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    // Store language preference in localStorage for now
    // In production, this should be stored in the database
    localStorage.setItem("preferred-language", value);
    toast.success("Language preference saved");
  };

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("preferred-language");
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Customize your experience and preferences.
          </p>
        </div>
        <Separator />
        <Skeleton className="h-20" />
        <Separator />
        <Skeleton className="h-32" />
        <Separator />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Customize your experience and preferences.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load preferences"
          message={error?.message || "Unable to load your notification preferences. Please try again."}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Customize your experience and preferences.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Language</h3>
        <p className="text-sm text-muted-foreground">
          Select your preferred language for the interface.
        </p>

        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[200px]">
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
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Choose how Rubic looks to you.
        </p>

        <div className="flex gap-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.value;

            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Manage your notification and communication preferences.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive email updates about your tasks
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updatePreferences.isPending && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="email-notifications"
                checked={emailEnabled}
                onCheckedChange={(checked) =>
                  handleToggle("emailEnabled", checked, setEmailEnabled)
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Push notifications</Label>
              <p className="text-xs text-muted-foreground">
                Get notified in your browser
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updatePreferences.isPending && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="push-notifications"
                checked={pushEnabled}
                onCheckedChange={(checked) =>
                  handleToggle("pushEnabled", checked, setPushEnabled)
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-notifications">In-app notifications</Label>
              <p className="text-xs text-muted-foreground">
                Show notifications within the app
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updatePreferences.isPending && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="in-app-notifications"
                checked={inAppEnabled}
                onCheckedChange={(checked) =>
                  handleToggle("inAppEnabled", checked, setInAppEnabled)
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notification-sound">Notification sound</Label>
              <p className="text-xs text-muted-foreground">
                Play a sound for new notifications
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updatePreferences.isPending && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="notification-sound"
                checked={inAppSound}
                onCheckedChange={(checked) =>
                  handleToggle("inAppSound", checked, setInAppSound)
                }
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Email Digest</h3>
        <p className="text-sm text-muted-foreground">
          How often would you like to receive email summaries?
        </p>

        <Select
          defaultValue={preferences?.emailDigest || "daily"}
          onValueChange={(value) => {
            updatePreferences.mutate({
              emailDigest: value as "instant" | "hourly" | "daily" | "weekly" | "never",
            });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
