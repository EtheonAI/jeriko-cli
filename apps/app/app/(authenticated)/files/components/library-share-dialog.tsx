"use client";

import { useState, useEffect } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  Dialog,
  DialogContent,
} from "@repo/design-system/components/ui/dialog";
import {
  LockIcon,
  GlobeIcon,
  LinkIcon,
  CheckIcon,
  CircleHelpIcon,
} from "lucide-react";
import { useLibraryData } from "@/lib/store/hooks";
import { toast } from "sonner";
import type { LibraryFile } from "./library-file-card";

// ============================================================================
// Manus Share Dialog — from share-header.html
// - 400px width, rounded-2xl
// - Header: "Share this file" + help icon
// - Access options: rounded-[8px] icon backgrounds (NOT rounded-full)
// - Social + Copy link on same row, Copy link = solid black button
// ============================================================================

interface LibraryShareDialogProps {
  file: LibraryFile;
  open: boolean;
  onClose: () => void;
}

export function LibraryShareDialog({ file, open, onClose }: LibraryShareDialogProps) {
  const [accessLevel, setAccessLevel] = useState<"private" | "public">("private");
  const [copied, setCopied] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [existingShare, setExistingShare] = useState<{ shareToken: string } | null>(null);

  const { createShare, getShare } = useLibraryData({ autoFetch: false });

  // Load existing share on open
  useEffect(() => {
    if (!open || !file.id) return;
    getShare(file.id)
      .then((data) => { if (data) setExistingShare(data as any); })
      .catch(() => {});
  }, [open, file.id, getShare]);

  async function handleCopyLink() {
    if (existingShare) {
      const shareUrl = `${window.location.origin}/share/${existingShare.shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      setIsPending(true);
      try {
        const data = await createShare(file.id);
        if (data) {
          const shareUrl = `${window.location.origin}/share/${(data as any).shareToken}`;
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          toast.success("Link copied to clipboard");
          setTimeout(() => setCopied(false), 2000);
        }
      } catch {
        toast.error("Failed to create share link");
      } finally {
        setIsPending(false);
      }
    }
  }

  function handleSocialShare(platform: "twitter" | "linkedin" | "facebook" | "reddit") {
    const shareUrl = existingShare
      ? `${window.location.origin}/share/${existingShare.shareToken}`
      : window.location.href;
    const text = `Check out "${file.name}" on Rubic`;

    const urls: Record<string, string> = {
      twitter: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(text)}`,
    };

    window.open(urls[platform], "_blank", "width=600,height=400");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="w-100 max-w-full sm:max-w-100 p-0 gap-0 border-0 rounded-2xl shadow-[0px_8px_32px_0px_rgba(0,0,0,0.12),0px_0px_0px_1px_rgba(0,0,0,0.06)]">
        {/* Header — Manus: py-3 px-4, border-b */}
        <div className="flex py-3 px-4 justify-between items-center border-b border-border">
          <h3 className="text-foreground text-base font-medium leading-5.5">Share this file</h3>
          <span className="inline-flex ml-auto cursor-help">
            <CircleHelpIcon className="size-4 text-muted-foreground" />
          </span>
        </div>

        {/* Content — Manus: pt-3 px-4 pb-4 */}
        <div className="pt-3 px-4 pb-4">
          {/* Access level options — Manus: rounded-[8px] icon bg, -mx-2 for full bleed */}
          <AccessOption
            icon={<LockIcon className="size-4" />}
            title="Task members only"
            description="Only you and people invited to this task"
            selected={accessLevel === "private"}
            onClick={() => setAccessLevel("private")}
          />
          <AccessOption
            icon={<GlobeIcon className="size-4" />}
            title="Public access"
            description="Anyone with a link can view"
            selected={accessLevel === "public"}
            onClick={() => setAccessLevel("public")}
          />

          {/* Social + Copy link row — Manus: mt-2 */}
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <SocialButton platform="twitter" onClick={() => handleSocialShare("twitter")} />
                <SocialButton platform="linkedin" onClick={() => handleSocialShare("linkedin")} />
                <SocialButton platform="facebook" onClick={() => handleSocialShare("facebook")} />
                <SocialButton platform="reddit" onClick={() => handleSocialShare("reddit")} />
              </div>
              {/* Manus: solid black button with link icon */}
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={isPending}
                className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors hover:opacity-90 active:opacity-80 bg-foreground text-background h-8 min-w-16 px-2 rounded-lg gap-1 text-sm leading-4.5 disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <CheckIcon className="size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="size-4" />
                    Copy link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Access level option — Manus: rounded-[8px] icon bg, px-2 -mx-2 for bleed
// ============================================================================

function AccessOption({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-2 -mx-2 py-2 rounded-lg text-left transition-colors hover:bg-muted/50"
    >
      {/* Manus: size-8, rounded-[8px], bg-muted */}
      <div className="size-8 rounded-lg flex items-center justify-center bg-muted shrink-0 text-foreground">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground">{description}</div>
      </div>
      <CheckIcon className={cn("size-5 ml-auto shrink-0", selected ? "text-foreground" : "invisible")} />
    </button>
  );
}

// ============================================================================
// Social buttons — Manus: outline style, size-8 rounded-full
// ============================================================================

function SocialButton({
  platform,
  onClick,
}: {
  platform: "twitter" | "linkedin" | "facebook" | "reddit";
  onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    twitter: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="16" height="16" className="text-foreground size-4">
        <path d="M9.09789 6.97909L13.9548 1.33334H12.8039L8.58662 6.23547L5.21831 1.33334H1.33337L6.42691 8.74623L1.33337 14.6667H2.48437L6.93789 9.48985L10.4951 14.6667H14.38L9.09761 6.97909H9.09789ZM7.52145 8.81154L7.00537 8.07338L2.89909 2.19978H4.66695L7.98076 6.93996L8.49685 7.67812L12.8044 13.8396H11.0365L7.52145 8.81182V8.81154Z" fill="currentColor" />
      </svg>
    ),
    linkedin: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="16" height="16" className="text-foreground size-4">
        <path d="M12.694 12.6941H10.7184V9.60019C10.7184 8.86243 10.7052 7.91269 9.69092 7.91269C8.66197 7.91269 8.50452 8.71654 8.50452 9.54649V12.6939H6.529V6.3316H8.42551V7.20107H8.45207C8.64187 6.87654 8.91613 6.60957 9.24565 6.42858C9.57518 6.24759 9.94762 6.15937 10.3233 6.17331C12.3257 6.17331 12.6948 7.4904 12.6948 9.20383L12.694 12.6941ZM4.29983 5.46196C3.66665 5.46206 3.15327 4.94884 3.15316 4.31566C3.15306 3.68248 3.66624 3.1691 4.29941 3.16899C4.93259 3.16884 5.44598 3.68206 5.44608 4.31524C5.44614 4.61931 5.3254 4.91094 5.11044 5.12599C4.89548 5.34104 4.6039 5.46189 4.29983 5.46196ZM5.28764 12.6941H3.30999V6.3316H5.28759V12.6941L5.28764 12.6941ZM13.6789 1.33425H2.31728C1.7803 1.32821 1.33994 1.75837 1.33337 2.29535V13.7044C1.33973 14.2416 1.78004 14.6722 2.31723 14.6665H13.6789C14.2172 14.6732 14.6593 14.2426 14.6667 13.7044V2.29446C14.659 1.75644 14.217 1.32634 13.6789 1.33337" fill="currentColor" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="text-foreground size-4">
        <circle cx="8" cy="8" r="7.33333" fill="currentColor" />
        <path d="M10.852 10.0365L11.1779 7.99943H9.22236V6.57351C9.22236 6.00314 9.42606 5.55499 10.3224 5.55499H11.2594V3.68091C10.7298 3.59943 10.1594 3.51795 9.62977 3.51795C7.9594 3.51795 6.77791 4.53647 6.77791 6.3698V7.99943H4.94458V10.0365H6.77791V15.2105C7.18532 15.292 7.59273 15.3328 8.00014 15.3328C8.40754 15.3328 8.81495 15.292 9.22236 15.2105V10.0365H10.852Z" fill="white" />
      </svg>
    ),
    reddit: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="16" height="16" className="text-foreground size-4">
        <path d="M10.0342 2.04908C10.2075 2.78388 10.8674 3.33127 11.6552 3.33127C12.5751 3.33127 13.3208 2.58554 13.3208 1.66568C13.3208 0.745814 12.5751 8.39233e-05 11.6552 8.39233e-05C10.851 8.39233e-05 10.1802 0.570118 10.024 1.32834C8.67701 1.4728 7.62518 2.61521 7.62518 3.99969C7.62518 4.00282 7.62518 4.00516 7.62518 4.00828C6.16027 4.06997 4.82265 4.48696 3.76066 5.14523C3.36632 4.83991 2.87125 4.65797 2.33402 4.65797C1.0448 4.65797 0 5.70277 0 6.99198C0 7.92746 0.549732 8.73332 1.34388 9.10579C1.42118 11.8154 4.37365 13.9948 8.00547 13.9948C11.6373 13.9948 14.5937 11.8131 14.6671 9.10111C15.455 8.72629 16 7.92278 16 6.99276C16 5.70355 14.9552 4.65875 13.666 4.65875C13.1311 4.65875 12.6384 4.83913 12.2448 5.14211C11.1735 4.47915 9.82099 4.06216 8.34124 4.00672C8.34124 4.00438 8.34124 4.00282 8.34124 4.00047C8.34124 3.00877 9.07838 2.18574 10.0342 2.05065V2.04908ZM3.66696 8.47329C3.706 7.62683 4.26823 6.97715 4.92182 6.97715C5.5754 6.97715 6.07516 7.66353 6.03612 8.50999C5.99707 9.35645 5.50903 9.66412 4.85466 9.66412C4.20029 9.66412 3.62792 9.31975 3.66696 8.47329ZM11.0899 6.97715C11.7443 6.97715 12.3065 7.62683 12.3448 8.47329C12.3838 9.31975 11.8106 9.66412 11.1571 9.66412C10.5035 9.66412 10.0146 9.35723 9.9756 8.50999C9.93655 7.66353 10.4355 6.97715 11.0899 6.97715ZM10.3122 10.4317C10.4347 10.4442 10.5128 10.5715 10.4652 10.6855C10.0631 11.6467 9.11352 12.3222 8.00547 12.3222C6.89741 12.3222 5.94866 11.6467 5.54573 10.6855C5.4981 10.5715 5.57618 10.4442 5.69878 10.4317C6.41718 10.3591 7.19414 10.3193 8.00547 10.3193C8.81679 10.3193 9.59297 10.3591 10.3122 10.4317Z" fill="currentColor" />
      </svg>
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center cursor-pointer ring-1 ring-inset ring-border border-none hover:opacity-90 hover:bg-muted/50 size-8 rounded-full"
      title={`Share on ${platform}`}
    >
      {icons[platform]}
    </button>
  );
}
