"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CloudIcon,
  CodeIcon,
  GlobeIcon,
  HistoryIcon,
  LaptopIcon,
  PaperclipIcon,
  PlusIcon,
  SparklesIcon,
  SquareIcon,
  UserIcon,
  BotIcon,
  ZapIcon,
  CircleIcon,
  CircleDotIcon,
  XIcon,
  FileIcon,
} from "lucide-react";
import { useFileUpload } from "@repo/ai/hooks";
import type { Attachment, MessagePart } from "@repo/ai/lib/types";
import type {
  RubicInputProps,
  RubicInputRef,
  InputConfig,
  ModelType,
  AgentType,
  PerformanceLevel,
  ToolType,
} from "./types";

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: InputConfig = {
  model: "cloud",
  agent: "agent",
  performance: "high",
  autoMode: false,
};

// ============================================================================
// Main Component
// ============================================================================

export const RubicInput = forwardRef<RubicInputRef, RubicInputProps>(
  function RubicInput(
    {
      onSubmit,
      onCancel,
      disabled = false,
      loading = false,
      streaming = false,
      placeholder = "Ask anything",
      className,
      initialConfig,
      onConfigChange,
      showConfigBar = true,
      onToolSelect,
    },
    ref
  ) {
    // State
    const [input, setInput] = useState("");
    const [config, setConfig] = useState<InputConfig>({
      ...defaultConfig,
      ...initialConfig,
    });

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File upload hook
    const { attachments, addFiles, removeFile, clearFiles, isUploading } =
      useFileUpload({
        maxSize: 50 * 1024 * 1024,
        maxFiles: 10,
      });

    // ========================================
    // Handlers
    // ========================================

    const updateConfig = useCallback(
      <K extends keyof InputConfig>(key: K, value: InputConfig[K]) => {
        setConfig((prev) => {
          const updated = { ...prev, [key]: value };
          onConfigChange?.(updated);
          return updated;
        });
      },
      [onConfigChange]
    );

    const handleSubmit = useCallback(() => {
      const trimmedInput = input.trim();
      if (!trimmedInput && attachments.length === 0) return;
      if (isUploading) return;

      const parts: MessagePart[] = [];
      if (trimmedInput) {
        parts.push({ type: "text", text: trimmedInput });
      }

      onSubmit(parts, attachments.length > 0 ? attachments : undefined, config);
      setInput("");
      clearFiles();
      textareaRef.current?.focus();
    }, [input, attachments, isUploading, config, onSubmit, clearFiles]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!loading && !disabled) {
            handleSubmit();
          }
        }
      },
      [handleSubmit, loading, disabled]
    );

    const handleTextareaInput = useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = "auto";
        target.style.height = `${target.scrollHeight}px`;
      },
      []
    );

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          addFiles(files);
        }
        e.target.value = "";
      },
      [addFiles]
    );

    const handleToolSelect = useCallback(
      (tool: ToolType) => {
        if (tool === "attach-files") {
          fileInputRef.current?.click();
        }
        onToolSelect?.(tool);
      },
      [onToolSelect]
    );

    // ========================================
    // Imperative Handle
    // ========================================

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => {
          setInput("");
          clearFiles();
        },
        setValue: (value: string) => setInput(value),
        getValue: () => input,
        submit: handleSubmit,
        getConfig: () => config,
      }),
      [input, config, handleSubmit, clearFiles]
    );

    // ========================================
    // Render
    // ========================================

    const canSubmit =
      !disabled &&
      !loading &&
      !isUploading &&
      (input.trim().length > 0 || attachments.length > 0);

    return (
      <div className={cn("w-full max-w-xl", className)}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFileSelect}
        />

        {/* Main input container */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative group flex items-center gap-2 px-2.5 py-1.5 bg-muted rounded-lg"
                >
                  <FileIcon className="size-4 text-muted-foreground" />
                  <span className="text-xs text-foreground max-w-[100px] truncate">
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(attachment.id)}
                    className="size-4 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="px-3 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full bg-transparent p-0 border-0 shadow-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground resize-none text-sm min-h-[40px] max-h-[25vh]"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="mb-2 px-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Plus menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent"
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="min-w-[180px] rounded-2xl p-1.5"
                >
                  <DropdownMenuGroup className="space-y-0.5">
                    <DropdownMenuItem
                      className="rounded-xl text-xs gap-2"
                      onClick={() => handleToolSelect("attach-files")}
                    >
                      <PaperclipIcon className="size-4 opacity-60" />
                      Attach Files
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl text-xs gap-2"
                      onClick={() => handleToolSelect("code-interpreter")}
                    >
                      <CodeIcon className="size-4 opacity-60" />
                      Code Interpreter
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl text-xs gap-2"
                      onClick={() => handleToolSelect("web-search")}
                    >
                      <GlobeIcon className="size-4 opacity-60" />
                      Web Search
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl text-xs gap-2"
                      onClick={() => handleToolSelect("chat-history")}
                    >
                      <HistoryIcon className="size-4 opacity-60" />
                      Chat History
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Auto mode toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateConfig("autoMode", !config.autoMode)}
                className={cn(
                  "h-7 px-2 rounded-full border hover:bg-accent gap-1",
                  config.autoMode
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border text-muted-foreground"
                )}
              >
                <SparklesIcon className="size-3" />
                <span className="text-xs">Auto</span>
              </Button>
            </div>

            {/* Submit/Cancel button */}
            <div>
              {streaming ? (
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

        {/* Configuration bar */}
        {showConfigBar && (
          <div className="flex items-center gap-0 pt-2">
            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs gap-1"
                >
                  {config.model === "local" ? (
                    <LaptopIcon className="size-3" />
                  ) : (
                    <CloudIcon className="size-3" />
                  )}
                  <span className="capitalize">{config.model}</span>
                  <ChevronDownIcon className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[120px] rounded-2xl p-1.5"
              >
                <DropdownMenuGroup className="space-y-0.5">
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("model", "local")}
                  >
                    <LaptopIcon className="size-4 opacity-60" />
                    Local
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("model", "cloud")}
                  >
                    <CloudIcon className="size-4 opacity-60" />
                    Cloud
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Agent selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs gap-1"
                >
                  {config.agent === "agent" ? (
                    <UserIcon className="size-3" />
                  ) : (
                    <BotIcon className="size-3" />
                  )}
                  <span className="capitalize">{config.agent}</span>
                  <ChevronDownIcon className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[120px] rounded-2xl p-1.5"
              >
                <DropdownMenuGroup className="space-y-0.5">
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("agent", "agent")}
                  >
                    <UserIcon className="size-4 opacity-60" />
                    Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("agent", "assistant")}
                  >
                    <BotIcon className="size-4 opacity-60" />
                    Assistant
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Performance selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs gap-1"
                >
                  <ZapIcon className="size-3" />
                  <span className="capitalize">{config.performance}</span>
                  <ChevronDownIcon className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[120px] rounded-2xl p-1.5"
              >
                <DropdownMenuGroup className="space-y-0.5">
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("performance", "high")}
                  >
                    <CircleIcon className="size-4 opacity-60" />
                    High
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("performance", "medium")}
                  >
                    <CircleDotIcon className="size-4 opacity-60" />
                    Medium
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl text-xs gap-2"
                    onClick={() => updateConfig("performance", "low")}
                  >
                    <CircleIcon className="size-4 opacity-60 fill-none" />
                    Low
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }
);
