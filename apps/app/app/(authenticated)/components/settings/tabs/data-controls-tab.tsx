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
} from "lucide-react";
import { toast } from "sonner";

export function DataControlsTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [settings, setSettings] = useState({
    saveHistory: true,
    analyticsEnabled: true,
    crashReports: true,
    personalizedExperience: true,
  });

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // TODO: Call API to export user data
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success("Export request submitted. You'll receive an email when ready.");
    } catch {
      toast.error("Failed to request data export");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearHistory = async () => {
    setIsDeletingHistory(true);
    try {
      // TODO: Call API to clear conversation history
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Conversation history cleared");
    } catch {
      toast.error("Failed to clear history");
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success("Settings updated");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data Controls</h2>
        <p className="text-sm text-muted-foreground">
          Manage your data and privacy settings.
        </p>
      </div>

      <Separator />

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldIcon className="h-4 w-4" />
            Privacy Settings
          </CardTitle>
          <CardDescription>
            Control how your data is used and stored.
          </CardDescription>
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
              checked={settings.saveHistory}
              onCheckedChange={(checked) => handleSettingChange("saveHistory", checked)}
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
              checked={settings.analyticsEnabled}
              onCheckedChange={(checked) => handleSettingChange("analyticsEnabled", checked)}
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
              checked={settings.crashReports}
              onCheckedChange={(checked) => handleSettingChange("crashReports", checked)}
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
              checked={settings.personalizedExperience}
              onCheckedChange={(checked) => handleSettingChange("personalizedExperience", checked)}
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
          <CardDescription>
            Export or delete your data from Rubic.
          </CardDescription>
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
              onClick={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
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
                    This will permanently delete all your conversations. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingHistory && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                    Clear History
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
          <CardDescription>
            How long we keep your data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Conversation History</span>
              </div>
              <Badge variant="secondary">90 days</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Files & Uploads</span>
              </div>
              <Badge variant="secondary">Until deleted</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Activity Logs</span>
              </div>
              <Badge variant="secondary">30 days</Badge>
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
                Your data is encrypted at rest and in transit. We follow industry best practices
                to protect your information. For more details, see our{" "}
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
