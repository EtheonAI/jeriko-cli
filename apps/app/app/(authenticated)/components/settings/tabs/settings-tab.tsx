"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Input } from "@repo/design-system/components/ui/input";
import { Button } from "@repo/design-system/components/ui/button";
import { useTheme } from "next-themes";
import {
  MonitorIcon,
  MoonIcon,
  SunIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { toast } from "sonner";
import { ErrorState } from "./error-state";

const notificationTypes = [
  { value: "system", label: "System" },
  { value: "session", label: "Session" },
  { value: "agent", label: "Agent" },
  { value: "team", label: "Team" },
  { value: "billing", label: "Billing" },
  { value: "connector", label: "Connector" },
  { value: "task", label: "Task" },
  { value: "mention", label: "Mention" },
  { value: "share", label: "Share" },
  { value: "comment", label: "Comment" },
] as const;

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
  const [preferences, setPreferences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      const data = await getTrpcClient().notifications.getPreferences.query();
      setPreferences(data);
      setIsError(false);
      setError(null);
    } catch (err: any) {
      setIsError(true);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Update preferences mutation
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);
  const doUpdatePreferences = useCallback(async (data: Record<string, any>, opts?: { onError?: () => void }) => {
    setIsUpdatingPrefs(true);
    try {
      await getTrpcClient().notifications.updatePreferences.mutate(data);
      await fetchPreferences(); // re-fetch instead of invalidate
    } catch (error: any) {
      toast.error(error?.message || "Failed to update preferences");
      opts?.onError?.();
    } finally {
      setIsUpdatingPrefs(false);
    }
  }, [fetchPreferences]);

  // Local state for switches (optimistic updates)
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [inAppSound, setInAppSound] = useState(true);

  // Quiet hours state
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [quietHoursTimezone, setQuietHoursTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Per-type settings state
  const [showTypeSettings, setShowTypeSettings] = useState(false);
  const [typeSettings, setTypeSettings] = useState<
    Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>
  >({});

  // Sync local state with server data
  useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.emailEnabled ?? true);
      setPushEnabled(preferences.pushEnabled ?? true);
      setInAppEnabled(preferences.inAppEnabled ?? true);
      setInAppSound(preferences.inAppSound ?? true);
      setQuietHoursEnabled((preferences as any).quietHoursEnabled ?? false);
      setQuietHoursStart((preferences as any).quietHoursStart ?? "22:00");
      setQuietHoursEnd((preferences as any).quietHoursEnd ?? "07:00");
      setQuietHoursTimezone(
        (preferences as any).quietHoursTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setTypeSettings((preferences as any).typeSettings ?? {});
    }
  }, [preferences]);

  const handleToggle = (
    field: "emailEnabled" | "pushEnabled" | "inAppEnabled" | "inAppSound" | "quietHoursEnabled",
    value: boolean,
    setState: (value: boolean) => void
  ) => {
    // Optimistic update
    setState(value);

    // Update server
    doUpdatePreferences(
      { [field]: value },
      {
        onError: () => {
          // Revert on error
          setState(!value);
        },
      }
    );
  };

  const handleQuietHoursTimeChange = (
    field: "quietHoursStart" | "quietHoursEnd",
    value: string,
    setState: (value: string) => void
  ) => {
    setState(value);
    doUpdatePreferences({ [field]: value });
  };

  const handleTimezoneChange = (value: string) => {
    setQuietHoursTimezone(value);
    doUpdatePreferences({ quietHoursTimezone: value });
  };

  const handleTypeSettingToggle = (
    type: string,
    channel: "email" | "push" | "inApp",
    value: boolean
  ) => {
    const updated = {
      ...typeSettings,
      [type]: {
        ...typeSettings[type],
        [channel]: value,
      },
    };
    setTypeSettings(updated);
    doUpdatePreferences({ typeSettings: updated });
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
          message={
            error?.message || "Unable to load your notification preferences. Please try again."
          }
          onRetry={() => fetchPreferences()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Customize your experience and preferences.</p>
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
        <p className="text-sm text-muted-foreground">Choose how Rubic looks to you.</p>

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
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
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
              {isUpdatingPrefs && (
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
              <p className="text-xs text-muted-foreground">Get notified in your browser</p>
            </div>
            <div className="flex items-center gap-2">
              {isUpdatingPrefs && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="push-notifications"
                checked={pushEnabled}
                onCheckedChange={(checked) => handleToggle("pushEnabled", checked, setPushEnabled)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-notifications">In-app notifications</Label>
              <p className="text-xs text-muted-foreground">Show notifications within the app</p>
            </div>
            <div className="flex items-center gap-2">
              {isUpdatingPrefs && (
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
              <p className="text-xs text-muted-foreground">Play a sound for new notifications</p>
            </div>
            <div className="flex items-center gap-2">
              {isUpdatingPrefs && (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="notification-sound"
                checked={inAppSound}
                onCheckedChange={(checked) => handleToggle("inAppSound", checked, setInAppSound)}
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
            doUpdatePreferences({
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

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Quiet Hours</h3>
        <p className="text-sm text-muted-foreground">
          Pause non-urgent push and in-app notifications during specific hours.
        </p>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="quiet-hours">Enable quiet hours</Label>
            <p className="text-xs text-muted-foreground">
              Non-urgent notifications will be silenced during this period
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isUpdatingPrefs && (
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="quiet-hours"
              checked={quietHoursEnabled}
              onCheckedChange={(checked) =>
                handleToggle("quietHoursEnabled", checked, setQuietHoursEnabled)
              }
            />
          </div>
        </div>

        {quietHoursEnabled && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="quiet-start" className="text-xs">
                  Start
                </Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) =>
                    handleQuietHoursTimeChange(
                      "quietHoursStart",
                      e.target.value,
                      setQuietHoursStart
                    )
                  }
                  className="w-[130px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quiet-end" className="text-xs">
                  End
                </Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) =>
                    handleQuietHoursTimeChange("quietHoursEnd", e.target.value, setQuietHoursEnd)
                  }
                  className="w-[130px]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quiet-timezone" className="text-xs">
                Timezone
              </Label>
              <Select value={quietHoursTimezone} onValueChange={handleTimezoneChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Intl.supportedValuesOf("timeZone").map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Per-Type Settings</h3>
            <p className="text-sm text-muted-foreground">
              Customize which channels are used for each notification type.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowTypeSettings(!showTypeSettings)}>
            {showTypeSettings ? (
              <>
                Hide <ChevronUpIcon className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Customize <ChevronDownIcon className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {showTypeSettings && (
          <div className="rounded-lg border">
            <div className="grid grid-cols-4 gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
              <div>Type</div>
              <div className="text-center">Email</div>
              <div className="text-center">Push</div>
              <div className="text-center">In-App</div>
            </div>
            {notificationTypes.map((nt) => (
              <div
                key={nt.value}
                className="grid grid-cols-4 items-center gap-4 border-b px-4 py-2 last:border-b-0"
              >
                <Label className="text-sm">{nt.label}</Label>
                <div className="flex justify-center">
                  <Switch
                    checked={typeSettings[nt.value]?.email !== false}
                    onCheckedChange={(checked) =>
                      handleTypeSettingToggle(nt.value, "email", checked)
                    }
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={typeSettings[nt.value]?.push !== false}
                    onCheckedChange={(checked) =>
                      handleTypeSettingToggle(nt.value, "push", checked)
                    }
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={typeSettings[nt.value]?.inApp !== false}
                    onCheckedChange={(checked) =>
                      handleTypeSettingToggle(nt.value, "inApp", checked)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
