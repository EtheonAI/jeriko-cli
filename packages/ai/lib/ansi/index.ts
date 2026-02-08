"use client";

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// ANSI Parser — shared utility for terminal-view + terminal-output-enhanced
// ============================================================================

export interface AnsiSegment {
  text: string;
  classes: string[];
}

const ANSI_COLORS: Record<number, string> = {
  30: "ansi-black",
  31: "ansi-red",
  32: "ansi-green",
  33: "ansi-yellow",
  34: "ansi-blue",
  35: "ansi-magenta",
  36: "ansi-cyan",
  37: "ansi-white",
  90: "ansi-bright-black",
  91: "ansi-bright-red",
  92: "ansi-bright-green",
  93: "ansi-bright-yellow",
  94: "ansi-bright-blue",
  95: "ansi-bright-magenta",
  96: "ansi-bright-cyan",
  97: "ansi-bright-white",
};

const ANSI_STYLES: Record<number, string> = {
  1: "ansi-bold",
  2: "ansi-dim",
  3: "ansi-italic",
  4: "ansi-underline",
};

/**
 * Parse ANSI escape codes in text into styled segments.
 * Handles standard 16 colors (30-37, 90-97), bold, dim, italic, underline.
 */
export function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        classes: [...currentClasses],
      });
    }

    const codes = match[1].split(";").map(Number).filter(Boolean);

    for (const code of codes) {
      if (code === 0) {
        currentClasses = [];
      } else if (ANSI_COLORS[code]) {
        currentClasses = currentClasses.filter(
          (c) =>
            !c.startsWith("ansi-") ||
            c.includes("bold") ||
            c.includes("dim") ||
            c.includes("italic") ||
            c.includes("underline")
        );
        currentClasses.push(ANSI_COLORS[code]);
      } else if (ANSI_STYLES[code]) {
        if (!currentClasses.includes(ANSI_STYLES[code])) {
          currentClasses.push(ANSI_STYLES[code]);
        }
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      classes: [...currentClasses],
    });
  }

  return segments;
}

/**
 * Strip all ANSI escape codes from text, returning plain text.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * React component that renders text with ANSI color support.
 * Uses CSS classes defined in tool-animations.css (ansi-red, ansi-green, etc.)
 */
export function AnsiText({ text }: { text: string }) {
  const segments = useMemo(() => parseAnsi(text), [text]);

  return React.createElement(
    React.Fragment,
    null,
    segments.map((segment, i) =>
      React.createElement("span", { key: i, className: cn(segment.classes) }, segment.text)
    )
  );
}
