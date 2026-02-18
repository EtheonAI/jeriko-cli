"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@repo/design-system/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  Loader2Icon,
  ShieldIcon,
  DatabaseIcon,
  DownloadIcon,
  TrashIcon,
  HistoryIcon,
  EyeOffIcon,
  FileTextIcon,
  AlertTriangleIcon,
  FolderIcon,
} from "lucide-react";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { toast } from "sonner";
import { ErrorState } from "./error-state";

export function DataControlsTab() {
  const [preferences, setPreferences] = useState<Awaited<ReturnType<ReturnType<typeof getTrpcClient>["user"]["getPreferences"]["query"]>> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [isUpdatePending, setIsUpdatePending] = useState(false);
  const [isExportPending, setIsExportPending] = useState(false);
  const [isClearHistoryPending, setIsClearHistoryPending] = useState(false);
  const [isClearFilesPending, setIsClearFilesPending] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = await getTrpcClient().user.getPreferences.query();
      setPreferences(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (input: Parameters<ReturnType<typeof getTrpcClient>["user"]["updatePreferences"]["mutate"]>[0]) => {
    try {
      setIsUpdatePending(true);
      await getTrpcClient().user.updatePreferences.mutate(input);
      toast.success("Settings updated");
      fetchPreferences();
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    } finally {
      setIsUpdatePending(false);
    }
  }, [fetchPreferences]);

  const exportData = useCallback(async () => {
    try {
      setIsExportPending(true);
      const data = await getTrpcClient().user.exportData.mutate();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rubic-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to export data");
    } finally {
      setIsExportPending(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      setIsClearHistoryPending(true);
      await getTrpcClient().user.clearChatHistory.mutate();
      toast.success("Conversation history cleared");
    } catch (error: any) {
      toast.error(error.message || "Failed to clear history");
    } finally {
      setIsClearHistoryPending(false);
    }
  }, []);

  const clearFiles = useCallback(async () => {
    try {
      setIsClearFilesPending(true);
      await getTrpcClient().user.clearFiles.mutate();
      toast.success("Files cleared");
    } catch (error: any) {
      toast.error(error.message || "Failed to clear files");
    } finally {
      setIsClearFilesPending(false);
    }
  }, []);

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Data Controls</h2>
          <p className="text-sm text-muted-foreground">Manage your data and privacy settings.</p>
        </div>
        <Separator />
        <Card>
          <CardContent className="pt-6">
            <div className="h-48 animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Data Controls</h2>
          <p className="text-sm text-muted-foreground">Manage your data and privacy settings.</p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load data controls"
          message="Unable to load your privacy settings. Please try again."
          onRetry={() => fetchPreferences()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data Controls</h2>
        <p className="text-sm text-muted-foreground">Manage your data and privacy settings.</p>
      </div>

      <Separator />

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldIcon className="h-4 w-4" />
            Privacy Settings
          </CardTitle>
          <CardDescription>Control how your data is used and stored.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Save Conversation History</Label>
              <p className="text-xs text-muted-foreground">
                Keep a record of your conversations with Rubic
              </p>
            </div>
            <Switch
              checked={preferences?.saveHistory ?? true}
              onCheckedChange={(checked) => handleToggle("saveHistory", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Analytics</Label>
              <p className="text-xs text-muted-foreground">
                Help improve Rubic by sharing anonymous usage data
              </p>
            </div>
            <Switch
              checked={preferences?.analyticsEnabled ?? true}
              onCheckedChange={(checked) => handleToggle("analyticsEnabled", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Crash Reports</Label>
              <p className="text-xs text-muted-foreground">
                Automatically send crash reports to help fix issues
              </p>
            </div>
            <Switch
              checked={preferences?.crashReports ?? true}
              onCheckedChange={(checked) => handleToggle("crashReports", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Personalized Experience</Label>
              <p className="text-xs text-muted-foreground">
                Use your data to provide personalized suggestions
              </p>
            </div>
            <Switch
              checked={preferences?.personalizedExperience ?? true}
              onCheckedChange={(checked) => handleToggle("personalizedExperience", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4" />
            Data Management
          </CardTitle>
          <CardDescription>Export or delete your data from Rubic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Data */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <DownloadIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Export Your Data</p>
                <p className="text-xs text-muted-foreground">
                  Download a copy of all your data in JSON format
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData()}
              disabled={isExportPending}
            >
              {isExportPending ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DownloadIcon className="h-4 w-4 mr-2" />
              )}
              Export
            </Button>
          </div>

          {/* Clear History */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <HistoryIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Clear Conversation History</p>
                <p className="text-xs text-muted-foreground">
                  Delete all your past conversations with Rubic
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear conversation history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your conversations. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearHistory()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearHistoryPending && (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Clear History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Clear Files */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FolderIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Clear Files</p>
                <p className="text-xs text-muted-foreground">
                  Delete all uploaded and generated files
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all files?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your uploaded and generated files. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearFiles()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearFilesPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                    Clear Files
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <EyeOffIcon className="h-4 w-4" />
            Data Retention
          </CardTitle>
          <CardDescription>Configure how long we keep your data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Conversation History</span>
              </div>
              <Select
                value={preferences?.conversationRetention || "90d"}
                onValueChange={(value) =>
                  updatePreferences({
                    conversationRetention: value as "30d" | "90d" | "1y" | "never",
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="never">Keep forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Files & Uploads</span>
              </div>
              <Select
                value={preferences?.fileRetention || "never"}
                onValueChange={(value) =>
                  updatePreferences({
                    fileRetention: value as "30d" | "90d" | "1y" | "never",
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="never">Keep forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Activity Logs</span>
              </div>
              <Select
                value={preferences?.activityLogRetention || "30d"}
                onValueChange={(value) =>
                  updatePreferences({
                    activityLogRetention: value as "30d" | "90d" | "1y" | "never",
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="never">Keep forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Data Security</h4>
              <p className="text-xs text-muted-foreground">
                Your data is encrypted at rest and in transit. We follow industry best practices to
                protect your information. For more details, see our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
