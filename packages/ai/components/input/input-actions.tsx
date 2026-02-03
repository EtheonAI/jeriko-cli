"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import {
  ArrowUpIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  SquareIcon,
  SparklesIcon,
  SettingsIcon,
  ImageIcon,
  CodeIcon,
  GlobeIcon,
} from "lucide-react";

export interface InputAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface InputActionsProps {
  className?: string;
  actions?: InputAction[];
  onSend?: () => void;
  onStop?: () => void;
  canSend?: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  showSend?: boolean;
  showVoice?: boolean;
  isRecording?: boolean;
  onVoiceToggle?: () => void;
  variant?: "default" | "compact";
}

/**
 * InputActions - Action buttons for chat input
 */
export function InputActions({
  className,
  actions = [],
  onSend,
  onStop,
  canSend = false,
  isStreaming = false,
  disabled = false,
  showSend = true,
  showVoice = false,
  isRecording = false,
  onVoiceToggle,
  variant = "default",
}: InputActionsProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {actions.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7",
                  action.active && "bg-primary/10 text-primary"
                )}
                onClick={action.onClick}
                disabled={action.disabled || disabled}
              >
                <action.icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {action.label}
                {action.shortcut && (
                  <kbd className="ml-2 rounded bg-muted px-1 text-xs">
                    {action.shortcut}
                  </kbd>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        {showSend && (
          isStreaming ? (
            <Button
              type="button"
              size="icon"
              className="size-7 rounded-full"
              onClick={onStop}
              disabled={disabled}
            >
              <SquareIcon className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="size-7 rounded-full"
              onClick={onSend}
              disabled={!canSend || disabled}
            >
              <ArrowUpIcon className="size-3.5" />
            </Button>
          )
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {/* Left actions */}
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  action.active && "bg-primary/10 text-primary"
                )}
                onClick={action.onClick}
                disabled={action.disabled || disabled}
              >
                <action.icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>
                {action.label}
                {action.shortcut && (
                  <kbd className="ml-2 rounded bg-muted px-1 text-xs">
                    {action.shortcut}
                  </kbd>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Voice button */}
        {showVoice && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  isRecording && "bg-destructive/10 text-destructive"
                )}
                onClick={onVoiceToggle}
                disabled={disabled}
              >
                {isRecording ? (
                  <MicOffIcon className="size-4" />
                ) : (
                  <MicIcon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isRecording ? "Stop recording" : "Voice input"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Send/Stop button */}
        {showSend && (
          isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="size-8 rounded-full"
                  onClick={onStop}
                  disabled={disabled}
                >
                  <SquareIcon className="size-3 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Stop generating</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={onSend}
                  disabled={!canSend || disabled}
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  Send message
                  <kbd className="ml-2 rounded bg-muted px-1 text-xs">Enter</kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Common input actions presets
 */
export const commonActions = {
  attach: (onClick: () => void): InputAction => ({
    id: "attach",
    icon: PaperclipIcon,
    label: "Attach file",
    onClick,
  }),
  image: (onClick: () => void): InputAction => ({
    id: "image",
    icon: ImageIcon,
    label: "Add image",
    onClick,
  }),
  code: (onClick: () => void, active = false): InputAction => ({
    id: "code",
    icon: CodeIcon,
    label: "Code mode",
    onClick,
    active,
  }),
  web: (onClick: () => void, active = false): InputAction => ({
    id: "web",
    icon: GlobeIcon,
    label: "Web search",
    onClick,
    active,
  }),
  enhance: (onClick: () => void, active = false): InputAction => ({
    id: "enhance",
    icon: SparklesIcon,
    label: "Enhance",
    onClick,
    active,
  }),
  settings: (onClick: () => void): InputAction => ({
    id: "settings",
    icon: SettingsIcon,
    label: "Settings",
    onClick,
  }),
};
