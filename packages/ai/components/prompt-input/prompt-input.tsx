/**
 * @repo/ai - OpenAI-Style Prompt Input Component
 *
 * A sophisticated, high-performance prompt input inspired by OpenAI's ChatGPT with:
 * - Animated rotating placeholder suggestions
 * - Optimistic updates and instant feedback
 * - Multi-modal input (text, files, voice, images)
 * - Clean, minimal design with OpenAI-style rounded corners
 * - Accessibility-first approach
 */

'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';
import { cn } from '@repo/design-system/lib/utils';
import {
  ArrowUpIcon,
  LoaderIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  StopCircleIcon,
  XIcon,
  ImageIcon,
  FileIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from 'lucide-react';

import { useVoiceInput } from '../../hooks/use-voice-input';
import { useFileUpload } from '../../hooks/use-file-upload';
import type { Attachment, MessagePart } from '../../lib/types/core';

// ============================================================================
// Types
// ============================================================================

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  icon?: React.ReactNode;
  external?: boolean;
}

export interface PromptInputProps {
  // Core
  onSubmit: (parts: MessagePart[], attachments?: Attachment[]) => void | Promise<void>;
  onCancel?: () => void;

  // State
  disabled?: boolean;
  loading?: boolean;
  streaming?: boolean;

  // Appearance
  placeholder?: string;
  title?: string;
  showTitle?: boolean;
  className?: string;
  minHeight?: number;
  maxHeight?: number;

  // Features
  showVoice?: boolean;
  showAttachments?: boolean;
  showSuggestions?: boolean;
  maxLength?: number;
  maxAttachments?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];

  // Placeholder animation
  animatedPlaceholders?: string[];
  placeholderInterval?: number;

  // Content
  suggestedActions?: SuggestedAction[];
  initialValue?: string;

  // Upload
  uploadEndpoint?: string;

  // Callbacks
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
}

export interface PromptInputRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  submit: () => void;
}

// ============================================================================
// Default animated placeholders (OpenAI-style)
// ============================================================================

const DEFAULT_PLACEHOLDERS = [
  'Ask anything...',
  'Write code for a landing page',
  'Explain how quantum computing works',
  'Help me debug this error',
  'Create a business plan',
  'Design a database schema',
  'Write a Python script',
  'Analyze this data',
  'Research a topic for me',
  'Plan a project timeline',
  'Help me with a presentation',
  'Summarize this document',
];

// ============================================================================
// Sub-components
// ============================================================================

function AnimatedPlaceholder({
  placeholders,
  interval = 3000,
  isVisible,
}: {
  placeholders: string[];
  interval?: number;
  isVisible: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % placeholders.length);
    }, interval);

    return () => clearInterval(timer);
  }, [placeholders.length, interval, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start px-4 pt-4">
      <div className="relative h-6 overflow-hidden w-full">
        <div
          className="transition-transform duration-500 ease-out"
          style={{
            transform: `translateY(-${currentIndex * 24}px)`,
          }}
        >
          {placeholders.map((text, i) => (
            <div
              key={i}
              className={cn(
                'h-6 text-muted-foreground/60 text-base leading-6 truncate',
                'transition-opacity duration-500',
                i === currentIndex ? 'opacity-100' : 'opacity-0'
              )}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceWaveform({ volume, isActive }: { volume: number; isActive: boolean }) {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5 h-4 px-1">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = i * 0.1;
        const baseHeight = 4;
        const maxHeight = 16;
        const height = isActive
          ? baseHeight + volume * (maxHeight - baseHeight) * Math.sin((Date.now() / 100 + i) * 0.5)
          : baseHeight;

        return (
          <div
            key={i}
            className={cn(
              'w-0.5 rounded-full transition-all duration-75',
              isActive ? 'bg-red-500' : 'bg-muted-foreground/50'
            )}
            style={{
              height: `${Math.max(baseHeight, Math.abs(height))}px`,
              transitionDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type === 'image';
  const isError = attachment.status === 'error';
  const isUploading = attachment.status === 'uploading';

  return (
    <div
      className={cn(
        'relative group flex items-center gap-2 px-3 py-2 rounded-xl',
        'border bg-muted/50 hover:bg-muted transition-colors',
        isError && 'border-destructive/50 bg-destructive/5'
      )}
    >
      {isImage && attachment.thumbnailUrl ? (
        <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 bg-muted">
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
            isError ? 'bg-destructive/10 text-destructive' : 'bg-muted'
          )}
        >
          {isError ? (
            <AlertCircleIcon className="h-4 w-4" />
          ) : isImage ? (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.name}</p>
        {isError ? (
          <p className="text-xs text-destructive truncate">{attachment.error}</p>
        ) : isUploading ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${attachment.progress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {attachment.progress ?? 0}%
            </span>
          </div>
        ) : attachment.status === 'ready' ? (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircleIcon className="h-3 w-3" />
            <span>Ready</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'absolute -top-1 -right-1 h-5 w-5 rounded-full',
          'bg-background border shadow-sm',
          'flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-muted'
        )}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Main Component
// ============================================================================

export const PromptInput = forwardRef<PromptInputRef, PromptInputProps>(
  function PromptInput(
    {
      onSubmit,
      onCancel,
      disabled = false,
      loading = false,
      streaming = false,
      placeholder,
      title = 'What can I help with?',
      showTitle = true,
      className,
      minHeight = 96,
      maxHeight = 200,
      showVoice = true,
      showAttachments = true,
      maxLength = 10000,
      maxAttachments = 10,
      maxFileSize = 50 * 1024 * 1024,
      allowedFileTypes = [],
      animatedPlaceholders = DEFAULT_PLACEHOLDERS,
      placeholderInterval = 3000,
      initialValue = '',
      uploadEndpoint = '/api/files/upload',
      onFocus,
      onBlur,
      onChange,
      onAttachmentsChange,
    },
    ref
  ) {
    // ========================================
    // State
    // ========================================

    const [value, setValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ========================================
    // Hooks
    // ========================================

    const {
      state: voiceState,
      isListening,
      interimTranscript,
      volume,
      toggle: toggleVoice,
      reset: resetVoice,
    } = useVoiceInput({
      continuous: false,
      interimResults: true,
      onResult: (text, isFinal) => {
        if (isFinal) {
          setValue((prev) => (prev ? `${prev} ${text}` : text));
        }
      },
      onError: (error) => {
        console.error('Voice input error:', error);
      },
    });

    const {
      attachments,
      isUploading,
      addFiles,
      removeFile,
      clearFiles,
    } = useFileUpload({
      endpoint: uploadEndpoint,
      maxSize: maxFileSize,
      maxFiles: maxAttachments,
      allowedTypes: allowedFileTypes,
      onChange: onAttachmentsChange,
    });

    // ========================================
    // Computed
    // ========================================

    const isDisabled = disabled || loading;
    const canSubmit = !isDisabled && (value.trim().length > 0 || attachments.some((a) => a.status === 'ready'));
    const hasContent = value.trim().length > 0;
    const showAnimatedPlaceholder = !hasContent && !isFocused && !isListening && !placeholder;

    // ========================================
    // Auto-resize
    // ========================================

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight - 52), maxHeight - 52);
      textarea.style.height = `${newHeight}px`;
    }, [value, minHeight, maxHeight]);

    // ========================================
    // Handlers
    // ========================================

    const handleSubmit = useCallback(async () => {
      if (!canSubmit) return;

      const parts: MessagePart[] = [];

      if (value.trim()) {
        parts.push({ type: 'text', text: value.trim() });
      }

      const readyAttachments = attachments.filter((a) => a.status === 'ready');
      for (const attachment of readyAttachments) {
        if (attachment.type === 'image' && attachment.url) {
          parts.push({
            type: 'image',
            url: attachment.url,
            alt: attachment.name,
            mimeType: attachment.mimeType,
          });
        } else if (attachment.url) {
          parts.push({
            type: 'file',
            url: attachment.url,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
          });
        }
      }

      if (parts.length === 0) return;

      await onSubmit(parts, readyAttachments);

      setValue('');
      clearFiles();
      resetVoice();
    }, [canSubmit, value, attachments, onSubmit, clearFiles, resetVoice]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [handleSubmit]
    );

    const handleFileSelect = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
          addFiles(files);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      [addFiles]
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onBlur?.();
    }, [onBlur]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange?.(newValue);
      },
      [onChange]
    );

    // ========================================
    // Imperative Handle
    // ========================================

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => {
        setValue('');
        clearFiles();
        resetVoice();
      },
      setValue: (v: string) => setValue(v),
      getValue: () => value,
      submit: () => handleSubmit(),
    }), [value, clearFiles, resetVoice, handleSubmit]);

    // ========================================
    // Render
    // ========================================

    return (
      <TooltipProvider delayDuration={300}>
        <div className={cn('flex flex-col items-center justify-center w-full', className)}>
          {/* Title */}
          {showTitle && (
            <h1 className="mb-6 text-center text-[28px] font-semibold leading-[34px] tracking-[0.3px]">
              {title}
            </h1>
          )}

          {/* Input Container - OpenAI style rounded corners */}
          <div className="relative w-full max-w-[768px]">
            <label
              className={cn(
                'relative flex flex-col w-full cursor-text overflow-hidden',
                'rounded-2xl md:rounded-3xl',
                'py-4 pe-[52px] ps-4',
                'bg-secondary dark:bg-secondary/50',
                'border border-border/30',
                'transition-all duration-200',
                isFocused && 'border-border/60 shadow-sm',
                isDisabled && 'opacity-60 cursor-not-allowed'
              )}
              onClick={() => textareaRef.current?.focus()}
            >
              {/* Screen reader label */}
              <div className="sr-only">Send a message</div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((attachment) => (
                    <AttachmentPreview
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => removeFile(attachment.id)}
                    />
                  ))}
                </div>
              )}

              {/* Voice transcript preview */}
              {isListening && interimTranscript && (
                <p className="text-sm text-muted-foreground italic mb-2">
                  {interimTranscript}
                </p>
              )}

              {/* Animated Placeholder */}
              <AnimatedPlaceholder
                placeholders={animatedPlaceholders}
                interval={placeholderInterval}
                isVisible={showAnimatedPlaceholder}
              />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={isListening ? 'Listening...' : placeholder}
                disabled={isDisabled}
                maxLength={maxLength}
                rows={2}
                className={cn(
                  'w-full resize-none bg-transparent outline-none',
                  'text-base leading-6',
                  'placeholder:text-muted-foreground/60',
                  'disabled:cursor-not-allowed',
                  'min-h-[48px]'
                )}
                style={{ maxHeight: `${maxHeight - 52}px` }}
              />

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={allowedFileTypes.length > 0 ? allowedFileTypes.join(',') : undefined}
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Left controls (bottom) */}
              <div className="flex items-center gap-1 mt-2">
                {showAttachments && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleFileSelect}
                        disabled={isDisabled || attachments.length >= maxAttachments}
                        className="h-8 w-8 rounded-full hover:bg-muted/80"
                      >
                        <PaperclipIcon className="h-[18px] w-[18px]" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Add files</TooltipContent>
                  </Tooltip>
                )}

                {showVoice && (
                  <>
                    {isListening && (
                      <VoiceWaveform volume={volume} isActive={isListening} />
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={toggleVoice}
                          disabled={isDisabled || voiceState === 'processing'}
                          className={cn(
                            'h-8 w-8 rounded-full',
                            isListening && 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                          )}
                        >
                          {voiceState === 'processing' ? (
                            <LoaderIcon className="h-[18px] w-[18px] animate-spin" />
                          ) : isListening ? (
                            <MicOffIcon className="h-[18px] w-[18px]" />
                          ) : (
                            <MicIcon className="h-[18px] w-[18px]" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isListening ? 'Stop recording' : 'Voice input'}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>

              {/* Submit button (absolute positioned - OpenAI style) */}
              <div className="absolute bottom-3 right-3">
                {streaming || loading ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onCancel}
                        className={cn(
                          'relative h-9 w-9 rounded-full p-0',
                          'bg-foreground text-background',
                          'hover:opacity-80 transition-opacity',
                          'flex items-center justify-center'
                        )}
                      >
                        <StopCircleIcon className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Stop</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit || isUploading}
                        aria-label="Send message"
                        className={cn(
                          'relative h-9 w-9 rounded-full p-0',
                          'transition-colors',
                          canSubmit && !isUploading
                            ? 'bg-foreground text-background hover:opacity-80'
                            : 'bg-muted text-muted-foreground cursor-default',
                          'flex items-center justify-center'
                        )}
                      >
                        {isUploading ? (
                          <LoaderIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <svg
                            height="36"
                            width="36"
                            fill="none"
                            viewBox="0 0 32 32"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M16 22L16 10M16 10L11 15M16 10L21 15"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.7"
                            />
                          </svg>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isUploading ? 'Uploading...' : canSubmit ? 'Send message' : 'Type a message'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </label>
          </div>

          {/* Character count */}
          {value.length > maxLength * 0.8 && (
            <div className="flex justify-end mt-2 px-2 w-full max-w-[768px]">
              <span
                className={cn(
                  'text-xs',
                  value.length > maxLength * 0.95
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {value.length.toLocaleString()} / {maxLength.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }
);

export default PromptInput;
