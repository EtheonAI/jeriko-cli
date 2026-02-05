"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { SparklesIcon, Loader2Icon } from "lucide-react";

interface AiGeneratePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AiGeneratePanel({ open, onOpenChange, projectId }: AiGeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const generate = trpc.websiteBuilder.generate.useMutation({
    onSuccess: (data) => {
      setResult(data.message);
    },
  });

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    setResult(null);
    generate.mutate({ projectId, prompt });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            AI Generate
          </SheetTitle>
          <SheetDescription>
            Describe what you want to build or change, and AI will generate the code for you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Create a landing page with a hero section, features grid, and footer..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {(generate.isPending || result) && (
            <div className="rounded-md border bg-muted/50 p-3">
              {generate.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Generating...
                </div>
              ) : (
                <p className="text-sm">{result}</p>
              )}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || generate.isPending}
            className="w-full"
          >
            {generate.isPending ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
