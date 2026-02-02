"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpIcon, LoaderIcon, StopCircleIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FileUploadButton } from "./file-upload-button";
import { VoiceInputButton } from "./voice-input-button";
import { ConnectionsButton } from "./connections-button";
import { AttachmentPreview } from "./attachment-preview";
import type {
  Attachment,
  AttachmentSource,
  ConnectedApp,
  PromptInputProps,
  PromptSubmitData,
  VoiceState,
} from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getAttachmentType(
  mimeType: string
): Attachment["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return "document";
  return "file";
}

const defaultConnectedApps: ConnectedApp[] = [
  { id: "gmail", name: "Gmail", icon: "", type: "email", connected: true },
  { id: "calendar", name: "Calendar", icon: "", type: "calendar", connected: true },
  { id: "browser", name: "Browser", icon: "", type: "browser", connected: true },
  { id: "drive", name: "Drive", icon: "", type: "storage", connected: true },
];

export function PromptInput({
  onSubmit,
  onCancel,
  placeholder = "Assign a task or ask anything...",
  disabled = false,
  loading = false,
  autoFocus = true,
  maxLength = 10000,
  minHeight = 50,
  maxHeight = 216,
  showToolbar = true,
  showConnections = true,
  showVoice = true,
  showFileUpload = true,
  connectedApps = defaultConnectedApps,
  className,
}: PromptInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    );
    textarea.style.height = `${newHeight}px`;
  }, [input, minHeight, maxHeight]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleFilesSelected = useCallback(
    (files: File[], source: AttachmentSource) => {
      const newAttachments: Attachment[] = files.map((file) => ({
        id: generateId(),
        name: file.name,
        type: getAttachmentType(file.type),
        source,
        file,
        size: file.size,
        mimeType: file.type,
        uploading: false,
        progress: 100,
        url: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    []
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.url) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const handleSubmit = useCallback(() => {
    if (loading || disabled) return;
    if (!input.trim() && attachments.length === 0) return;

    const data: PromptSubmitData = {
      text: input.trim(),
      attachments,
      selectedApps,
    };

    onSubmit(data);

    // Clear state after submit
    setInput("");
    setAttachments([]);
  }, [input, attachments, selectedApps, loading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSubmit =
    !loading &&
    !disabled &&
    (input.trim().length > 0 || attachments.length > 0);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("w-full max-w-3xl mx-auto", className)}>
        <div
          className={cn(
            "flex flex-col gap-3 rounded-[22px] relative",
            "bg-background py-3 w-full z-[2]",
            "shadow-[0px_12px_32px_0px_rgba(0,0,0,0.02)]",
            "border border-border/60",
            "transition-colors duration-200",
            isFocused && "border-border"
          )}
        >
          {/* Attachment Preview */}
          <AttachmentPreview
            attachments={attachments}
            onRemove={handleRemoveAttachment}
          />

          {/* Textarea */}
          <div
            className={cn(
              "overflow-auto px-4 bg-transparent",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "w-full text-[15px] leading-6",
              `min-h-[${minHeight}px] max-h-[${maxHeight}px]`
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || loading}
              maxLength={maxLength}
              rows={1}
              className={cn(
                "w-full bg-transparent resize-none outline-none",
                "placeholder:text-muted-foreground/60",
                "text-[15px] leading-6",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              style={{
                minHeight: `${minHeight}px`,
                maxHeight: `${maxHeight}px`,
              }}
            />
          </div>

          {/* Controls Row */}
          {showToolbar && (
            <div className="px-3">
              <div className="flex items-center justify-between gap-2">
                {/* Left Controls */}
                <div className="flex items-center gap-2">
                  {showFileUpload && (
                    <FileUploadButton
                      onFilesSelected={handleFilesSelected}
                      disabled={disabled || loading}
                    />
                  )}
                  {showConnections && (
                    <ConnectionsButton
                      apps={connectedApps}
                      selectedApps={selectedApps}
                      onSelectionChange={setSelectedApps}
                      disabled={disabled || loading}
                    />
                  )}
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-2">
                  {showVoice && (
                    <VoiceInputButton
                      onTranscript={handleVoiceTranscript}
                      onStateChange={setVoiceState}
                      disabled={disabled || loading}
                    />
                  )}

                  {/* Submit/Stop Button */}
                  {loading ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={onCancel}
                          className="h-8 w-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <StopCircleIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Stop generating</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={handleSubmit}
                          disabled={!canSubmit}
                          className={cn(
                            "h-8 w-8 rounded-full transition-all",
                            canSubmit
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {loading ? (
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowUpIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {canSubmit ? "Send message" : "Type a message"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Character count (optional, shown when approaching limit) */}
        {input.length > maxLength * 0.8 && (
          <div className="flex justify-end mt-1 px-2">
            <span
              className={cn(
                "text-xs",
                input.length > maxLength * 0.95
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {input.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
