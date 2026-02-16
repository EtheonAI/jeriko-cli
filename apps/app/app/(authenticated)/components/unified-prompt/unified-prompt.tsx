"use client";

import { forwardRef, useCallback, useImperativeHandle, useState, type KeyboardEvent } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpIcon, CableIcon, LoaderIcon, SquareIcon, XIcon } from "lucide-react";

import type { ChatPromptProps, ChatPromptRef } from "./types";
import { usePromptState } from "./use-prompt-state";
import { AttachmentRow } from "./attachment-row";
import { FilesButton } from "./files-button";
import { ConnectionsModal } from "./connections-modal";
import { ConnectorsDialog } from "./connectors-dialog";
import { SkillsButton } from "./skills-button";
import { VoiceInputButton } from "./voice-input-button";
import { AnimatedPlaceholder } from "./animated-placeholder";
import { QuickActions, ACTION_PREFILLS } from "./quick-actions";

export const ChatPrompt = forwardRef<ChatPromptRef, ChatPromptProps>(function ChatPrompt(
  {
    onSubmit,
    placeholder,
    disabled = false,
    isStreaming = false,
    onCancel,
    showQuickActions = false,
    showConfigBar = false,
    initialValue = "",
    initialModel,
    maxLength,
    className,
    showVoice = true,
    showAnimatedPlaceholder = true,
    animatedPlaceholders,
    onFocus,
    onBlur,
  },
  ref
) {
  const {
    text,
    setText,
    textareaRef,
    handleTextareaResize,
    isFocused,
    handleFocus: internalHandleFocus,
    handleBlur: internalHandleBlur,
    activeSkills,
    toggleSkill,
    selectedConnections,
    toggleConnection,
    attachments,
    addFiles,
    removeFile,
    isUploading,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    reset,
  } = usePromptState({ initialValue, initialModel });

  const [showPanel, setShowPanel] = useState(true);
  const [showConnectorsDialog, setShowConnectorsDialog] = useState(false);

  // ========================================
  // Handlers
  // ========================================

  const handleFocus = useCallback(() => {
    internalHandleFocus();
    onFocus?.();
  }, [internalHandleFocus, onFocus]);

  const handleBlur = useCallback(() => {
    internalHandleBlur();
    onBlur?.();
  }, [internalHandleBlur, onBlur]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isUploading) return;

    onSubmit(trimmed, attachments, {
      skills: activeSkills.length > 0 ? activeSkills : undefined,
      connections: selectedConnections.length > 0 ? selectedConnections : undefined,
    });

    reset();
    textareaRef.current?.focus();
  }, [
    text,
    attachments,
    isUploading,
    activeSkills,
    selectedConnections,
    onSubmit,
    reset,
    textareaRef,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !isStreaming) {
          handleSubmit();
        }
      }
    },
    [handleSubmit, disabled, isStreaming]
  );

  const handleTextareaInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      if (maxLength && target.value.length > maxLength) return;
      handleTextareaResize();
    },
    [handleTextareaResize, maxLength]
  );

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      addFiles(files);
    },
    [addFiles]
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      textareaRef.current?.focus();
      setTimeout(handleTextareaResize, 0);
    },
    [setText, textareaRef, handleTextareaResize]
  );

  const handleQuickAction = useCallback(
    (actionId: string) => {
      const prefill = ACTION_PREFILLS[actionId] ?? "";
      setText(prefill);
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = prefill.length;
        }
      }, 0);
    },
    [setText, textareaRef]
  );

  // ========================================
  // Imperative Handle
  // ========================================

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => reset(),
      setValue: (value: string) => setText(value),
      getValue: () => text,
      submit: handleSubmit,
    }),
    [text, handleSubmit, reset, setText, textareaRef]
  );

  // ========================================
  // Computed
  // ========================================

  const isDisabled = disabled || isStreaming;
  const canSubmit = !disabled && !isUploading && (text.trim().length > 0 || attachments.length > 0);

  const showPlaceholderAnimation =
    showAnimatedPlaceholder && !placeholder && text.length === 0 && !isFocused;

  // ========================================
  // Render
  // ========================================

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("relative w-full", className)}>
        {/* Wrapper creates stacking context for z-[2] overlap with panel */}
        <div className="relative">
          <label
            className={cn(
              "relative z-[2] flex flex-col w-full cursor-text overflow-hidden",
              showConfigBar && showPanel ? "rounded-[22px]" : "rounded-2xl md:rounded-3xl",
              "py-4 pe-[52px] ps-4",
              "bg-secondary dark:bg-secondary",
              "border border-border/30",
              "transition-all duration-200",
              isFocused && "border-border/60 shadow-sm",
              isDragging && "border-primary/50 bg-primary/5 shadow-md",
              isDisabled && "opacity-60 cursor-not-allowed"
            )}
            onClick={() => textareaRef.current?.focus()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Screen reader label */}
            <span className="sr-only">Send a message</span>

            {/* Drag overlay */}
            {isDragging && (
              <div
                className={cn(
                  "absolute inset-0 z-10 flex items-center justify-center bg-primary/5",
                  showConfigBar && showPanel ? "rounded-[22px]" : "rounded-2xl md:rounded-3xl"
                )}
              >
                <p className="text-sm text-primary font-medium">Drop files here</p>
              </div>
            )}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <AttachmentRow attachments={attachments} onRemove={removeFile} />
              </div>
            )}

            {/* Animated Placeholder */}
            <AnimatedPlaceholder
              placeholders={animatedPlaceholders}
              isVisible={showPlaceholderAnimation}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPaste={handlePaste}
              placeholder={
                showPlaceholderAnimation ? undefined : (placeholder ?? "Ask anything...")
              }
              data-testid="prompt-input"
              disabled={isDisabled}
              maxLength={maxLength}
              rows={2}
              className={cn(
                "w-full resize-none bg-transparent outline-none",
                "text-base leading-6",
                "placeholder:text-muted-foreground/60",
                "disabled:cursor-not-allowed",
                "min-h-[52px] max-h-[200px]"
              )}
            />

            {/* Bottom controls — inside the container */}
            <div className="flex items-center gap-1 mt-2">
              <FilesButton onFilesSelected={handleFilesSelected} disabled={disabled} />
              <ConnectionsModal
                disabled={disabled}
                selectedConnections={selectedConnections}
                onToggleConnection={toggleConnection}
                onOpenDialog={() => setShowConnectorsDialog(true)}
              />
              <SkillsButton
                activeSkills={activeSkills}
                onToggle={toggleSkill}
                disabled={disabled}
              />
              {showVoice && (
                <VoiceInputButton disabled={disabled} onTranscript={handleVoiceTranscript} />
              )}
            </div>

            {/* Submit / Stop button — absolute bottom-right (OpenAI style) */}
            <div className="absolute bottom-3 right-3">
              {isStreaming ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onCancel?.();
                      }}
                      className={cn(
                        "relative h-9 w-9 rounded-full p-0",
                        "bg-foreground text-background",
                        "hover:opacity-80 transition-opacity",
                        "flex items-center justify-center"
                      )}
                    >
                      <SquareIcon className="h-4 w-4 fill-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Stop</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                      disabled={!canSubmit || isUploading}
                      aria-label="Send message"
                      className={cn(
                        "relative h-9 w-9 rounded-full p-0",
                        "transition-colors",
                        canSubmit && !isUploading
                          ? "bg-foreground text-background hover:opacity-80"
                          : "bg-muted text-muted-foreground cursor-default",
                        "flex items-center justify-center"
                      )}
                    >
                      {isUploading ? (
                        <LoaderIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowUpIcon className="h-5 w-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isUploading ? "Uploading..." : canSubmit ? "Send message" : "Type a message"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </label>
        </div>

        {/* Bottom Panel — connect devices (dashboard only) */}
        {showConfigBar && showPanel && (
          <div
            className="
                bg-[rgba(55,53,47,0.02)] dark:bg-[rgba(255,255,255,0.02)]
                hover:bg-[rgba(240,239,237,1)] dark:hover:bg-[rgba(255,255,255,0.04)]
                border-x border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.1)]
                rounded-b-[22px] pb-[7px] px-5 pt-[29px] -mt-[22px]
                transition-colors cursor-pointer select-none
              "
            onClick={() => setShowConnectorsDialog(true)}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-[6px]">
                <CableIcon
                  className="text-[#666] dark:text-[#999]"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[13px] leading-[18px] text-[#666] dark:text-[#999] tracking-[-0.091px] flex-1 truncate">
                Connect devices
              </span>
              <div className="flex-shrink-0 flex items-center justify-end gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Connectors preview"
                  className="h-[22px] w-auto"
                  src="https://files.manuscdn.com/webapp/_next/static/media/connectorsDark.0f49332b.png"
                />
                <button
                  className="flex items-center justify-center hover:opacity-70 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPanel(false);
                  }}
                  aria-label="Close panel"
                >
                  <XIcon
                    className="text-[#999] dark:text-[#666]"
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions chips (dashboard only) */}
        {showQuickActions && <QuickActions onSelect={handleQuickAction} />}

        {/* Character count */}
        {maxLength && text.length > maxLength * 0.8 && (
          <div className="flex justify-end mt-2 px-2">
            <span
              className={cn(
                "text-xs",
                text.length >= maxLength ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {text.length.toLocaleString()}/{maxLength.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Connectors Dialog (Manus-style full modal) */}
      <ConnectorsDialog open={showConnectorsDialog} onOpenChange={setShowConnectorsDialog} />
    </TooltipProvider>
  );
});
