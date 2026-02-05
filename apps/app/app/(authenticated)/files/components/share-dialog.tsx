"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { CopyIcon, CheckIcon, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import type { FileItem } from "./file-card";

interface ShareDialogProps {
  file: FileItem | null;
  onClose: () => void;
}

export function ShareDialog({ file, onClose }: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"viewer" | "editor">("viewer");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!file) return;
    setGenerating(true);
    try {
      // Generate a share token client-side (in production this would call the backend)
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      toast.success("Share link created");
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    setAccessLevel("viewer");
    onClose();
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{file?.name}"</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Access level</Label>
            <Select
              value={accessLevel}
              onValueChange={(v) => setAccessLevel(v as "viewer" | "editor")}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer - can view and download</SelectItem>
                <SelectItem value="editor">Editor - can view, download, and edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {shareUrl ? (
            <div>
              <Label>Share link</Label>
              <div className="mt-1.5 flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              <LinkIcon className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate share link"}
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
