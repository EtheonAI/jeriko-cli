"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ImageIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface ImageGenInput {
  prompt: string;
  filename?: string;
}

interface ImageGenOutput {
  image_path?: string;
  image_url?: string;
  image_data?: string;
  prompt: string;
  model?: string;
  filename?: string;
  generated?: boolean;
  error?: string;
}

export interface ImageResultProps extends ToolRendererProps<ImageGenInput, ImageGenOutput> {}

/**
 * ImageResult - Renders generated image results from Nano Banana (Gemini).
 */
export function ImageResult({ state, input, output }: ImageResultProps) {
  // Loading state
  if (state !== "output-available") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <SparklesIcon className="size-4" />
        <span>Generating image: "{input?.prompt ?? "..."}"</span>
      </div>
    );
  }

  // Error state
  if (output?.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">Image generation failed: {output.error}</p>
      </div>
    );
  }

  // Determine image source
  const imageSrc = output?.image_data
    ? `data:image/png;base64,${output.image_data}`
    : (output?.image_url ?? null);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ImageIcon className="size-4" />
        <span>Generated image</span>
        {output?.model && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{output.model}</span>
        )}
      </div>

      {/* Image */}
      {imageSrc ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <img
            src={imageSrc}
            alt={output?.prompt ?? input?.prompt ?? "Generated image"}
            className="w-full"
          />
        </div>
      ) : output?.image_path ? (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
          <ImageIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Image saved to sandbox: {output.image_path}
          </p>
        </div>
      ) : null}

      {/* Prompt */}
      {(output?.prompt ?? input?.prompt) && (
        <p className="text-xs text-muted-foreground italic">"{output?.prompt ?? input?.prompt}"</p>
      )}
    </div>
  );
}
