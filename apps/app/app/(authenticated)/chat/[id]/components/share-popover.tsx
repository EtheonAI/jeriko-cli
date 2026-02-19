"use client";

import { useState, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/design-system/components/ui/tabs";
import { ShareIcon, CopyIcon, CheckIcon, GlobeIcon, LockIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTrpcClient } from "@/lib/trpc/vanilla";

interface SharePopoverProps {
  sessionId: string;
  isShared: boolean;
  shareId?: string | null;
  onShareChange?: (isPublic: boolean) => void;
}

export function SharePopover({
  sessionId,
  isShared,
  shareId,
  onShareChange,
}: SharePopoverProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(isShared ? "public" : "private");
  const [isLoading, setIsLoading] = useState(false);

  const getShareLink = () => {
    const origin = window.location.origin;
    return `${origin}/share/${shareId ?? sessionId}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTabChange = useCallback(
    async (value: string) => {
      setActiveTab(value);
      setIsLoading(true);

      try {
        const client = getTrpcClient();
        if (value === "public") {
          await client.sessions.shareSession.mutate({ sessionId });
          toast.success("Session shared publicly");
        } else {
          await client.sessions.unshareSession.mutate({ sessionId });
          toast.success("Session is now private");
        }
        onShareChange?.(value === "public");
      } catch {
        toast.error("Failed to update sharing settings");
        // Revert tab on error
        setActiveTab(value === "public" ? "private" : "public");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, onShareChange]
  );

  const handleShareOnX = () => {
    const text = encodeURIComponent(
      "Check out what I built with Rubic! An AI-powered platform for automating tasks."
    );
    const url = encodeURIComponent(getShareLink());
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShareIcon className="h-4 w-4" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4">
          <h4 className="font-semibold text-sm mb-3">Share</h4>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              <TabsTrigger value="public" className="flex-1 gap-1.5 text-xs" disabled={isLoading}>
                <GlobeIcon className="h-3.5 w-3.5" />
                Public Access
              </TabsTrigger>
              <TabsTrigger value="private" className="flex-1 gap-1.5 text-xs" disabled={isLoading}>
                <LockIcon className="h-3.5 w-3.5" />
                Only Me
              </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Anyone with the link can view this conversation.
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="private" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Only you can access this conversation.
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Share on X promo */}
        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={handleShareOnX}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Share Rubic tips on X and earn up to{" "}
            <span className="font-semibold text-foreground">50,000 credits</span>.
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
