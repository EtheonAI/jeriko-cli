"use client";

import { useEffect, useState } from "react";
import { cn } from "@repo/design-system/lib/utils";

const DEFAULT_PLACEHOLDERS = [
  "Ask anything...",
  "Write code for a landing page",
  "Explain how quantum computing works",
  "Help me debug this error",
  "Create a business plan",
  "Design a database schema",
  "Write a Python script",
  "Analyze this data",
  "Research a topic for me",
  "Plan a project timeline",
];

interface AnimatedPlaceholderProps {
  placeholders?: string[];
  interval?: number;
  isVisible: boolean;
  className?: string;
}

export function AnimatedPlaceholder({
  placeholders = DEFAULT_PLACEHOLDERS,
  interval = 3000,
  isVisible,
  className,
}: AnimatedPlaceholderProps) {
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
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex items-start ps-4 pe-[52px] pt-4",
        className
      )}
    >
      <div className="relative h-6 overflow-hidden w-full">
        <div
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translateY(-${currentIndex * 24}px)` }}
        >
          {placeholders.map((text, i) => (
            <div
              key={text}
              className={cn(
                "h-6 text-muted-foreground/60 text-base leading-6 truncate",
                "transition-opacity duration-500",
                i === currentIndex ? "opacity-100" : "opacity-0"
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

export { DEFAULT_PLACEHOLDERS };
