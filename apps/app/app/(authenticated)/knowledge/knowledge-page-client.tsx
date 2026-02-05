"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  setSearchValue,
  setViewType,
  setSortBy,
  setSelectedGroup,
} from "@/lib/store/slices/knowledge.slice";
import { Input } from "@repo/design-system/components/ui/input";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { LayoutGridIcon, ListIcon, PlusIcon, SearchIcon } from "lucide-react";
import { KnowledgeGroupSidebar } from "./components/knowledge-group-sidebar";
import { KnowledgeItemCard } from "./components/knowledge-item-card";
import { AddItemDialog } from "./components/add-item-dialog";
import { ItemDetailDialog } from "./components/item-detail-dialog";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export function KnowledgePageClient() {
  const dispatch = useAppDispatch();
  const { viewType, searchValue, sortBy, selectedGroupId } = useAppSelector(
    (state) => state.knowledge
  );

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  const groupsQuery = trpc.knowledge.listGroups.useQuery({ parentId: undefined });
  const itemsQuery = trpc.knowledge.listItems.useQuery({
    groupId: selectedGroupId ?? undefined,
    search: searchValue || undefined,
    limit: 50,
    offset: 0,
  });

  const handleSearch = useCallback(
    (value: string) => {
      dispatch(setSearchValue(value));
    },
    [dispatch]
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — groups */}
      <KnowledgeGroupSidebar
        groups={groupsQuery.data ?? []}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(id) => dispatch(setSelectedGroup(id))}
        isLoading={groupsQuery.isLoading}
        onRefetch={groupsQuery.refetch}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search knowledge..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={sortBy}
            onValueChange={(value) =>
              dispatch(setSortBy(value as "name" | "createdAt" | "size" | "type"))
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date added</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md">
            <Button
              variant={viewType === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => dispatch(setViewType("grid"))}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => dispatch(setViewType("list"))}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-6">
          {itemsQuery.isLoading ? (
            <div
              className={
                viewType === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-2"
              }
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={viewType === "grid" ? "h-40" : "h-16"} />
              ))}
            </div>
          ) : !itemsQuery.data || itemsQuery.data.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <SearchIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No items yet</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
                Add documents, text notes, or web URLs to build your knowledge base for AI-powered
                context.
              </p>
              <Button className="mt-6" onClick={() => setAddDialogOpen(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add your first item
              </Button>
            </div>
          ) : (
            <div
              className={
                viewType === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-2"
              }
            >
              {itemsQuery.data.map((item) => (
                <KnowledgeItemCard
                  key={item.id}
                  item={item}
                  viewType={viewType}
                  onClick={() => setDetailItemId(item.id)}
                  onRefetch={itemsQuery.refetch}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        groupId={selectedGroupId}
        onSuccess={() => {
          itemsQuery.refetch();
          groupsQuery.refetch();
        }}
      />

      {detailItemId && (
        <ItemDetailDialog
          itemId={detailItemId}
          open={!!detailItemId}
          onOpenChange={(open) => {
            if (!open) setDetailItemId(null);
          }}
          onRefetch={() => {
            itemsQuery.refetch();
            groupsQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
