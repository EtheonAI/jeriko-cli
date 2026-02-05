"use client";

import { forwardRef, useCallback, useImperativeHandle, type KeyboardEvent } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpIcon, SquareIcon } from "lucide-react";

import type { UnifiedPromptProps, UnifiedPromptRef } from "./types";
import { usePromptState } from "./use-prompt-state";
import { AttachmentRow } from "./attachment-row";
import { FilesButton } from "./files-button";
import { ConnectorsButton } from "./connectors-button";
import { SkillsButton } from "./skills-button";
import { ModelSelector } from "./model-selector";
import { QuickActions, ACTION_PREFILLS } from "./quick-actions";

export const UnifiedPrompt = forwardRef<UnifiedPromptRef, UnifiedPromptProps>(
  function UnifiedPrompt(
    {
      onSubmit,
      placeholder = "Ask anything...",
      disabled = false,
      isStreaming = false,
      onCancel,
      showQuickActions = false,
      showConfigBar = false,
      initialValue = "",
      initialModel,
      maxLength,
      className,
    },
    ref
  ) {
    const {
      text,
      setText,
      textareaRef,
      handleTextareaResize,
      selectedModel,
      setSelectedModel,
      activeSkills,
      toggleSkill,
      attachments,
      addFiles,
      removeFile,
      isUploading,
      reset,
    } = usePromptState({ initialValue, initialModel });

    // ========================================
    // Handlers
    // ========================================

    const handleSubmit = useCallback(() => {
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;
      if (isUploading) return;

      onSubmit(trimmed, attachments, {
        model: selectedModel,
        skills: activeSkills.length > 0 ? activeSkills : undefined,
      });

      reset();
      textareaRef.current?.focus();
    }, [text, attachments, isUploading, selectedModel, activeSkills, onSubmit, reset, textareaRef]);

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

    const handleQuickAction = useCallback(
      (actionId: string) => {
        const prefill = ACTION_PREFILLS[actionId] ?? "";
        setText(prefill);
        // Focus and move cursor to end
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

    const canSubmit =
      !disabled && !isUploading && (text.trim().length > 0 || attachments.length > 0);

    // ========================================
    // Render
    // ========================================

    return (
      <div className={cn("w-full max-w-xl", className)}>
        {/* Main input container */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          {/* Attachment previews */}
          <AttachmentRow attachments={attachments} onRemove={removeFile} />

          {/* Textarea */}
          <div className="px-3 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              placeholder={placeholder}
              disabled={disabled || isStreaming}
              maxLength={maxLength}
              rows={1}
              className="w-full bg-transparent p-0 border-0 shadow-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground resize-none text-sm min-h-[40px] max-h-[25vh]"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="mb-2 px-2 flex items-center justify-between">
            {/* Left: action buttons */}
            <div className="flex items-center gap-1">
              <FilesButton onFilesSelected={handleFilesSelected} disabled={disabled} />
              <ConnectorsButton disabled={disabled} />
              <SkillsButton
                activeSkills={activeSkills}
                onToggle={toggleSkill}
                disabled={disabled}
              />
            </div>

            {/* Right: model + submit */}
            <div className="flex items-center gap-1">
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={disabled}
              />

              {isStreaming ? (
                <Button
                  type="button"
                  onClick={onCancel}
                  size="sm"
                  className="size-7 p-0 rounded-full bg-foreground hover:bg-foreground/90"
                >
                  <SquareIcon className="size-3 fill-background text-background" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  size="sm"
                  className="size-7 p-0 rounded-full bg-primary disabled:opacity-40"
                >
                  <ArrowUpIcon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions chips (dashboard only) */}
        {showQuickActions && <QuickActions onSelect={handleQuickAction} />}

        {/* Character count */}
        {maxLength && text.length > maxLength * 0.8 && (
          <div className="flex justify-end px-1 pt-1">
            <span
              className={cn(
                "text-xs",
                text.length >= maxLength ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {text.length}/{maxLength}
            </span>
          </div>
        )}
      </div>
    );
  }
);
