"use client";

import * as React from "react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowUpIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
  FileIcon,
  MicIcon,
  SparklesIcon,
} from "lucide-react";
import type { MessagePart } from "../../lib/types";
import { AttachmentDropzone } from "./attachment-dropzone";
import { InputActions } from "./input-actions";

/**
 * Simple attachment type for the chat composer
 */
export interface ChatAttachment {
  id: string;
  name: string;
  type?: string;
  size?: number;
  url?: string;
}

export interface ChatComposerRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  submit: () => void;
}

export interface ChatComposerProps {
  onSubmit: (parts: MessagePart[], attachments?: ChatAttachment[]) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  onFileSelect?: (files: FileList) => void;
  showAttachButton?: boolean;
  showVoiceButton?: boolean;
  voiceEnabled?: boolean;
  onVoiceToggle?: () => void;
  renderActions?: (props: { canSubmit: boolean; isStreaming: boolean }) => React.ReactNode;
  sendOnEnter?: boolean;
}

/**
 * ChatComposer - Enhanced input wrapper for chat interfaces
 */
export const ChatComposer = forwardRef<ChatComposerRef, ChatComposerProps>(
  function ChatComposer(
    {
      onSubmit,
      onCancel,
      disabled = false,
      isLoading = false,
      isStreaming = false,
      placeholder = "Type a message...",
      className,
      maxLength,
      attachments = [],
      onAttachmentsChange,
      onFileSelect,
      showAttachButton = true,
      showVoiceButton = false,
      voiceEnabled = false,
      onVoiceToggle,
      renderActions,
      sendOnEnter = true,
    },
    ref
  ) {
    const [input, setInput] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canSubmit = !disabled && !isLoading && (input.trim().length > 0 || attachments.length > 0);

    // Handle submit
    const handleSubmit = useCallback(() => {
      if (!canSubmit) return;

      const parts: MessagePart[] = [];
      if (input.trim()) {
        parts.push({ type: "text", text: input.trim() });
      }

      onSubmit(parts, attachments.length > 0 ? attachments : undefined);
      setInput("");
      textareaRef.current?.focus();
    }, [canSubmit, input, attachments, onSubmit]);

    // Handle key down
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && sendOnEnter) {
          e.preventDefault();
          if (canSubmit && !isStreaming) {
            handleSubmit();
          }
        }
      },
      [canSubmit, isStreaming, handleSubmit, sendOnEnter]
    );

    // Auto-resize textarea
    const handleInput = useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = "auto";
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
      },
      []
    );

    // Handle file selection
    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          onFileSelect?.(files);
        }
        e.target.value = "";
      },
      [onFileSelect]
    );

    // Handle drop
    const handleDrop = useCallback(
      (files: FileList) => {
        setIsDragging(false);
        onFileSelect?.(files);
      },
      [onFileSelect]
    );

    // Remove attachment
    const handleRemoveAttachment = useCallback(
      (id: string) => {
        onAttachmentsChange?.(attachments.filter((a) => a.id !== id));
      },
      [attachments, onAttachmentsChange]
    );

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => setInput(""),
        setValue: (value: string) => setInput(value),
        getValue: () => input,
        submit: handleSubmit,
      }),
      [input, handleSubmit]
    );

    return (
      <div className={cn("relative", className)}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFileChange}
        />

        {/* Dropzone overlay */}
        <AttachmentDropzone
          onDrop={handleDrop}
          onDragChange={setIsDragging}
          className={cn(
            "pointer-events-none absolute inset-0 z-10 transition-opacity",
            isDragging ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Main container */}
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-background transition-colors",
            isDragging && "border-primary"
          )}
        >
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5"
                >
                  <FileIcon className="size-4 text-muted-foreground" />
                  <span className="max-w-[120px] truncate text-xs">
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="relative px-3 pt-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={placeholder}
              disabled={disabled || isStreaming}
              maxLength={maxLength}
              rows={1}
              className="w-full resize-none bg-transparent p-0 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: "40px", maxHeight: "200px" }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Attach button */}
              {showAttachButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  <PaperclipIcon className="size-4" />
                </Button>
              )}

              {/* Voice button */}
              {showVoiceButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8",
                    voiceEnabled && "text-primary"
                  )}
                  onClick={onVoiceToggle}
                  disabled={disabled}
                >
                  <MicIcon className="size-4" />
                </Button>
              )}

              {/* Custom actions */}
              {renderActions?.({ canSubmit, isStreaming })}
            </div>

            {/* Submit/Cancel */}
            <div className="flex items-center gap-1">
              {/* Character count */}
              {maxLength && input.length > maxLength * 0.8 && (
                <span
                  className={cn(
                    "text-xs",
                    input.length >= maxLength
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {input.length}/{maxLength}
                </span>
              )}

              {isStreaming ? (
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={onCancel}
                >
                  <SquareIcon className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
