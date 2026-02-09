// use-canvas.ts

import { useState, useEffect, useMemo } from "react";
import { useChat, type Message } from "@ai-sdk/react";

// ... (Keep your other imports and type definitions)

export function useCanvas(initialMessages?: Message[]) {
  const { messages, setMessages } = useChat({ initialMessages });

  // State for the LIVE view, updated by SSE metadata
  const [liveBrowserScreenshot, setLiveBrowserScreenshot] = useState<string | null>(null);
  const [liveBrowserUrl, setLiveBrowserUrl] = useState<string>("");
  const [liveSandboxId, setLiveSandboxId] = useState<string | null>(null);

  // State for the PINNED (historical) view
  const [pinnedToolCallId, setPinnedToolCallId] = useState<string | null>(null);

  // Effect to listen to the latest message for live updates from metadata
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.experimental_metadata) {
      const meta = lastMessage.experimental_metadata;
      
      if (meta.browserFrame) {
        setLiveBrowserScreenshot(meta.browserFrame.screenshot);
        setLiveBrowserUrl(meta.browserFrame.url);
      }
      if (meta.sandboxId) {
        setLiveSandboxId(meta.sandboxId);
      }
    }
  }, [messages]);

  // --- Logic to derive PINNED state ---
  // This part of your original logic was good. It finds the tool call
  // associated with the pinned ID and extracts its state.
  const pinnedToolParts = useMemo(() => {
    if (!pinnedToolCallId) return null;
    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        const toolPart = message.parts.find(
          (part) => part.type.startsWith("tool-") && part.toolCallId === pinnedToolCallId
        );
        if (toolPart) return toolPart;
      }
    }
    return null;
  }, [pinnedToolCallId, messages]);

  // --- Determine which state to display: LIVE or PINNED ---
  const isLive = !pinnedToolCallId;

  const viewType = useMemo(() => {
    if (isLive) {
      // In live mode, we can default to browser or another view
      return "browser"; 
    } else if (pinnedToolParts) {
      // In pinned mode, derive view from the tool part type
      if (pinnedToolParts.type === "tool-browser_navigate") return "browser";
      if (pinnedToolParts.type === "tool-shell_exec") return "terminal";
      // ... add other mappings
    }
    return "empty";
  }, [isLive, pinnedToolParts]);

  // --- Get the correct data for the current view ---
  const browserScreenshot = isLive 
    ? liveBrowserScreenshot 
    : (pinnedToolParts?.output as any)?.screenshot || null;

  const browserUrl = isLive
    ? liveBrowserUrl
    : (pinnedToolParts?.output as any)?.url || "";

  const sandboxId = isLive ? liveSandboxId : null; // Sandbox actions only on live view

  // --- Handlers ---
  const onUnpin = () => setPinnedToolCallId(null);
  const onPin = (toolCallId: string) => setPinnedToolCallId(toolCallId);

  // Browser actions should only be possible in live mode
  const onBrowserNavigate = async (url: string) => {
    if (!isLive || !sandboxId) return;
    // This is the new endpoint you need to create
    await fetch(`/api/sandbox/browser`, {
      method: "POST",
      body: JSON.stringify({ sandboxId, action: "navigate", args: { url } }),
    });
  };

  return {
    viewType,
    isLive,
    sandboxId,
    
    // Browser View Props
    browserScreenshot,
    browserUrl,
    browserLoading: false, // Add real loading state

    // Handlers
    onPin,
    onUnpin,
    onBrowserNavigate,
    // ... other handlers for back, forward, etc.
  };
}
