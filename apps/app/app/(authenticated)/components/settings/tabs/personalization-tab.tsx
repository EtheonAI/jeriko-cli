"use client";

import { useState, useEffect } from "react";
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
import { Loader2Icon, UserIcon, SparklesIcon, LayoutIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { ErrorState } from "./error-state";

const modelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
  { value: "gpt-4o", label: "GPT-4o (Balanced)" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude 4.5 Sonnet" },
  { value: "claude-opus-4-5-20251101", label: "Claude 4.5 Opus" },
];

export function PersonalizationTab() {
  // Fetch user profile and preferences
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = trpc.user.getProfile.useQuery(undefined, { retry: 1 });
  const {
    data: preferences,
    isLoading: prefsLoading,
    isError: prefsError,
    refetch: refetchPrefs,
  } = trpc.user.getPreferences.useQuery(undefined, { retry: 1 });
  const utils = trpc.useUtils();

  const [bio, setBio] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (preferences?.bio) setBio(preferences.bio);
    if (preferences?.customInstructions) setCustomInstructions(preferences.customInstructions);
  }, [preferences]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.user.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const updatePreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferences saved");
      utils.user.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });

  const isLoading = profileLoading || prefsLoading;
  const isError = profileError || prefsError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Personalization</h2>
          <p className="text-sm text-muted-foreground">Customize your Rubic experience.</p>
        </div>
        <Separator />
        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="h-32 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="h-48 animate-pulse bg-muted rounded" />
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
          <p className="text-sm text-muted-foreground">Customize your Rubic experience.</p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load personalization settings"
          message="Unable to load your personalization preferences. Please try again."
          onRetry={() => {
            refetchProfile();
            refetchPrefs();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Personalization</h2>
        <p className="text-sm text-muted-foreground">Customize your Rubic experience.</p>
      </div>

      <Separator />

      {/* Profile Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Customize how others see you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              defaultValue={profile?.name || ""}
              placeholder="Your display name"
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePreferences.mutate({ bio })}
            disabled={updatePreferences.isPending}
          >
            {updatePreferences.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
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
          <CardDescription>Customize how Rubic interacts with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Model</Label>
            <Select
              value={preferences?.defaultModel || "gpt-4o-mini"}
              onValueChange={(value) => updatePreferences.mutate({ defaultModel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Communication Style</Label>
            <Select
              value={preferences?.communicationStyle || "balanced"}
              onValueChange={(value) =>
                updatePreferences.mutate({
                  communicationStyle: value as "concise" | "balanced" | "detailed",
                })
              }
            >
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
            <Select
              value={preferences?.expertiseLevel || "intermediate"}
              onValueChange={(value) =>
                updatePreferences.mutate({
                  expertiseLevel: value as "beginner" | "intermediate" | "expert",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner - Explain technical terms</SelectItem>
                <SelectItem value="intermediate">
                  Intermediate - Some technical knowledge
                </SelectItem>
                <SelectItem value="expert">Expert - Full technical depth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Custom Instructions</Label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Add any specific instructions for how Rubic should behave..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be considered in every conversation
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePreferences.mutate({ customInstructions })}
            disabled={updatePreferences.isPending}
          >
            {updatePreferences.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
            Save Instructions
          </Button>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutIcon className="h-4 w-4" />
            Display
          </CardTitle>
          <CardDescription>Adjust how content is displayed in conversations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Select
              value={preferences?.fontSize || "medium"}
              onValueChange={(value) =>
                updatePreferences.mutate({ fontSize: value as "small" | "medium" | "large" })
              }
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chat Density</Label>
            <Select
              value={preferences?.chatDensity || "comfortable"}
              onValueChange={(value) =>
                updatePreferences.mutate({
                  chatDensity: value as "compact" | "comfortable" | "spacious",
                })
              }
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact - Less spacing</SelectItem>
                <SelectItem value="comfortable">Comfortable - Default spacing</SelectItem>
                <SelectItem value="spacious">Spacious - More spacing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
