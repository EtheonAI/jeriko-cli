"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { MicIcon, MicOffIcon } from "lucide-react";
import { useVoiceInput, type UseVoiceInputReturn } from "@repo/ai/hooks";

// ============================================================================
// Waveform Visualization
// ============================================================================

function VoiceWaveform({ volume, isActive }: { volume: number; isActive: boolean }) {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5 h-4 px-0.5">
      {Array.from({ length: bars }).map((_, i) => {
        const baseHeight = 4;
        const maxHeight = 16;
        const height = isActive
          ? baseHeight + volume * (maxHeight - baseHeight) * (0.5 + 0.5 * Math.sin(i * 1.2))
          : baseHeight;

        return (
          <div
            key={i}
            className={cn(
              "w-0.5 rounded-full transition-all duration-75",
              isActive ? "bg-red-500" : "bg-muted-foreground/50"
            )}
            style={{ height: `${Math.max(baseHeight, Math.abs(height))}px` }}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Voice Input Button
// ============================================================================

interface VoiceInputButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInputButton({ disabled, onTranscript, className }: VoiceInputButtonProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const voice: UseVoiceInputReturn = useVoiceInput({
    onEnd: (finalTranscript) => {
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
    },
  });

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleClick = useCallback(() => {
    voice.toggle();
  }, [voice.toggle]);

  if (!hasMounted || !voice.isSupported) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={handleClick}
          className={cn(
            "h-7 px-2 rounded-full text-xs gap-1",
            voice.isListening
              ? "text-red-500 bg-red-500/10 hover:bg-red-500/15"
              : "text-muted-foreground hover:bg-accent",
            className
          )}
        >
          {voice.isListening ? (
            <>
              <VoiceWaveform volume={voice.volume} isActive />
              <MicOffIcon className="size-3" />
            </>
          ) : (
            <MicIcon className="size-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {voice.isListening ? "Stop recording" : "Voice input"}
      </TooltipContent>
    </Tooltip>
  );
}
