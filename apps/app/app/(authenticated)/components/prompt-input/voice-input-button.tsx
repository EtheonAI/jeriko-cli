"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { MicIcon, MicOffIcon, LoaderIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceState } from "./types";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

type VoiceInputButtonProps = {
  onTranscript: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  disabled?: boolean;
  className?: string;
};

// Waveform visualization component
function WaveformIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-0.5 bg-current rounded-full transition-all duration-150",
            isActive
              ? "animate-pulse"
              : "h-1"
          )}
          style={{
            height: isActive ? `${Math.random() * 12 + 4}px` : "4px",
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceInputButton({
  onTranscript,
  onStateChange,
  disabled = false,
  className,
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognitionAPI = (
      window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).SpeechRecognition || (
      window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setState("listening");
      onStateChange?.("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");

      if (event.results[0].isFinal) {
        onTranscript(transcript);
        setState("idle");
        onStateChange?.("idle");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setState("error");
      onStateChange?.("error");
      setTimeout(() => {
        setState("idle");
        onStateChange?.("idle");
      }, 2000);
    };

    recognition.onend = () => {
      if (state === "listening") {
        setState("idle");
        onStateChange?.("idle");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onTranscript, onStateChange, state]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (state === "listening") {
      recognitionRef.current.stop();
      setState("processing");
      onStateChange?.("processing");
    } else if (state === "idle") {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
  }, [state, onStateChange]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {state === "listening" && (
        <div className="flex items-center gap-1.5 px-2 h-8 rounded-full text-primary">
          <WaveformIndicator isActive />
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || state === "processing"}
            onClick={toggleRecording}
            className={cn(
              "h-8 w-8 rounded-full shrink-0",
              state === "listening" && "bg-red-500/10 text-red-500 hover:bg-red-500/20",
              state === "error" && "text-destructive",
              className
            )}
          >
            {state === "processing" ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : state === "listening" ? (
              <MicOffIcon className="h-4 w-4" />
            ) : (
              <MicIcon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {state === "listening" ? "Stop recording" : "Voice input"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

