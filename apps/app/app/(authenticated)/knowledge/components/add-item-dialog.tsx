"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Button } from "@repo/design-system/components/ui/button";
import { StickyNoteIcon, GlobeIcon, FileUpIcon } from "lucide-react";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
  onSuccess: () => void;
}

export function AddItemDialog({ open, onOpenChange, groupId, onSuccess }: AddItemDialogProps) {
  const [tab, setTab] = useState<"text" | "url" | "file">("text");

  // Text note state
  const [textName, setTextName] = useState("");
  const [textContent, setTextContent] = useState("");

  // URL state
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");

  // File state
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");

  const createMutation = trpc.knowledge.createItem.useMutation({
    onSuccess: () => {
      resetForm();
      onOpenChange(false);
      onSuccess();
    },
  });

  function resetForm() {
    setTextName("");
    setTextContent("");
    setUrlName("");
    setUrlValue("");
    setFileName("");
    setFileContent("");
  }

  function handleSubmit() {
    if (tab === "text") {
      createMutation.mutate({
        type: "note",
        name: textName.trim(),
        content: textContent,
        groupId: groupId ?? undefined,
      });
    } else if (tab === "url") {
      createMutation.mutate({
        type: "webpage",
        name: urlName.trim() || urlValue,
        sourceUrl: urlValue.trim(),
        groupId: groupId ?? undefined,
      });
    } else if (tab === "file") {
      // For file/PDF — pass content as text (user pastes content for now)
      createMutation.mutate({
        type: "document",
        name: fileName.trim(),
        content: fileContent,
        mimeType: "text/plain",
        groupId: groupId ?? undefined,
      });
    }
  }

  const isValid =
    (tab === "text" && textName.trim() && textContent.trim()) ||
    (tab === "url" && urlValue.trim()) ||
    (tab === "file" && fileName.trim() && fileContent.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Item</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "url" | "file")}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1 gap-2">
              <StickyNoteIcon className="h-4 w-4" />
              Text Note
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-2">
              <GlobeIcon className="h-4 w-4" />
              Web URL
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-2">
              <FileUpIcon className="h-4 w-4" />
              Paste Content
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Meeting Notes"
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="Paste or type your text here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <Input
                placeholder="e.g. Company Blog Post"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL</label>
              <Input
                placeholder="https://example.com/article"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                type="url"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The page will be fetched, converted to text, and indexed for search.
            </p>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Technical Spec"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="Paste the document content here..."
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={8}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your document text content. File upload with drag-and-drop coming soon.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!isValid || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
