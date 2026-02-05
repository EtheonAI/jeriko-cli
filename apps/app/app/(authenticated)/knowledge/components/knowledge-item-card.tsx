"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  FileTextIcon,
  GlobeIcon,
  StickyNoteIcon,
  FileIcon,
  BookmarkIcon,
  MoreVerticalIcon,
  Trash2Icon,
  RefreshCwIcon,
} from "lucide-react";

const typeIcons: Record<string, typeof FileTextIcon> = {
  document: FileTextIcon,
  webpage: GlobeIcon,
  note: StickyNoteIcon,
  file: FileIcon,
  bookmark: BookmarkIcon,
};

const statusColors: Record<string, string> = {
  processing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  archived: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

interface KnowledgeItem {
  id: string;
  type: string;
  name: string;
  description: string | null;
  contentPreview: string | null;
  status: string;
  sourceUrl: string | null;
  createdAt: Date;
}

interface KnowledgeItemCardProps {
  item: KnowledgeItem;
  viewType: "grid" | "list";
  onClick: () => void;
  onRefetch: () => void;
}

export function KnowledgeItemCard({ item, viewType, onClick, onRefetch }: KnowledgeItemCardProps) {
  const deleteMutation = trpc.knowledge.deleteItem.useMutation({
    onSuccess: onRefetch,
  });

  const Icon = typeIcons[item.type] || FileIcon;
  const preview = item.contentPreview || item.description || "";
  const date = new Date(item.createdAt).toLocaleDateString();

  if (viewType === "list") {
    return (
      <div
        className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.name}</span>
            <Badge variant="outline" className={`text-[10px] ${statusColors[item.status] ?? ""}`}>
              {item.status}
            </Badge>
          </div>
          {preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{date}</span>
        <ItemActions
          itemId={item.id}
          onDelete={() => deleteMutation.mutate({ id: item.id })}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div
      className="group relative flex flex-col rounded-lg border p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <ItemActions
          itemId={item.id}
          onDelete={() => deleteMutation.mutate({ id: item.id })}
          isDeleting={deleteMutation.isPending}
        />
      </div>
      <h4 className="mt-3 text-sm font-medium truncate">{item.name}</h4>
      {preview && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{preview}</p>}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <Badge variant="outline" className={`text-[10px] ${statusColors[item.status] ?? ""}`}>
          {item.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{date}</span>
      </div>
    </div>
  );
}

function ItemActions({
  itemId,
  onDelete,
  isDeleting,
}: {
  itemId: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            // Reprocess would call the knowledge service endpoint
          }}
        >
          <RefreshCwIcon className="h-4 w-4 mr-2" />
          Reprocess
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
