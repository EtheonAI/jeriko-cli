"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import {
  AppWindowIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PresentationIcon,
  SendIcon,
} from "lucide-react";
import { useState } from "react";

type ToolbarAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const toolbarActions: ToolbarAction[] = [
  {
    id: "slides",
    label: "Create slides",
    icon: <PresentationIcon className="h-4 w-4" />,
  },
  {
    id: "website",
    label: "Build website",
    icon: <GlobeIcon className="h-4 w-4" />,
  },
  {
    id: "apps",
    label: "Generate apps",
    icon: <AppWindowIcon className="h-4 w-4" />,
  },
  {
    id: "design",
    label: "Design",
    icon: <PaletteIcon className="h-4 w-4" />,
  },
  {
    id: "more",
    label: "More",
    icon: <MoreHorizontalIcon className="h-4 w-4" />,
  },
];

export const ChatInputToolbar = () => {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Demo: just clear the input
    setInput("");
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="rounded-xl border bg-background shadow-sm">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="border-0 bg-transparent px-4 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center justify-between border-t px-2 py-2">
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1">
                {toolbarActions.map((action) => (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {action.icon}
                        <span className="hidden sm:inline text-xs">
                          {action.label}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{action.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-2"
              disabled={!input.trim()}
            >
              <SendIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
