"use client";

import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";

interface ThinkingIndicatorProps {
  /** Label to display — defaults to "Thinking" */
  label?: string;
  /** Compact inline variant (no message wrapper) */
  inline?: boolean;
}

/**
 * Animated thinking orb — three pulsing dots that orbit/cascade,
 * matching the blue accent used in AgentCanvas status bar.
 */
function ThinkingOrb({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      {/* Orbiting dots container */}
      <div className="relative flex items-center justify-center size-5">
        <span
          className="absolute size-[7px] rounded-full bg-blue-500 opacity-90"
          style={{
            animation: "rubic-orbit 1.4s ease-in-out infinite",
          }}
        />
        <span
          className="absolute size-[5px] rounded-full bg-blue-400 opacity-70"
          style={{
            animation: "rubic-orbit 1.4s ease-in-out 0.2s infinite",
          }}
        />
        <span
          className="absolute size-[3px] rounded-full bg-blue-300 opacity-50"
          style={{
            animation: "rubic-orbit 1.4s ease-in-out 0.4s infinite",
          }}
        />
      </div>

      <span className="text-sm text-[var(--rubic-text-secondary)] font-medium">
        {label}
        <span className="inline-flex w-[18px] overflow-hidden align-baseline">
          <span
            style={{
              animation: "rubic-ellipsis 1.5s steps(4, end) infinite",
            }}
          >
            ...
          </span>
        </span>
      </span>

      {/* Keyframes — scoped via inline style tag */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes rubic-orbit {
  0%, 100% { transform: translateX(-6px) scale(0.8); opacity: 0.4; }
  50% { transform: translateX(6px) scale(1); opacity: 1; }
}
@keyframes rubic-ellipsis {
  0% { width: 0; }
  25% { width: 6px; }
  50% { width: 12px; }
  75% { width: 18px; }
  100% { width: 0; }
}
`,
        }}
      />
    </div>
  );
}

export function ThinkingIndicator({ label, inline }: ThinkingIndicatorProps) {
  if (inline) {
    return (
      <div className="py-1.5">
        <ThinkingOrb label={label} />
      </div>
    );
  }

  return (
    <Message from="assistant">
      <MessageContent>
        <ThinkingOrb label={label} />
      </MessageContent>
    </Message>
  );
}
