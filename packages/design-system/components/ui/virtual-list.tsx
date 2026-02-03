"use client";

import * as React from "react";
import { useRef, useCallback } from "react";
import { useVirtualizer, type VirtualizerOptions } from "@tanstack/react-virtual";
import { cn } from "@repo/design-system/lib/utils";

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  gap?: number;
  horizontal?: boolean;
  getItemKey?: (index: number) => string | number;
}

/**
 * VirtualList - High-performance virtualized list component
 *
 * Only renders items visible in the viewport plus a small overscan buffer.
 * Dramatically improves performance for large lists (100+ items).
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={messages}
 *   renderItem={(message, index) => <MessageItem key={message.id} message={message} />}
 *   estimateSize={80}
 *   className="h-[500px]"
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
  className,
  gap = 0,
  horizontal = false,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    horizontal,
    getItemKey: getItemKey || ((index) => index),
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: horizontal ? "100%" : virtualizer.getTotalSize(),
          width: horizontal ? virtualizer.getTotalSize() : "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: horizontal ? 0 : virtualItem.start,
              left: horizontal ? virtualItem.start : 0,
              width: horizontal ? undefined : "100%",
              height: horizontal ? "100%" : undefined,
              paddingBottom: !horizontal && gap ? gap : undefined,
              paddingRight: horizontal && gap ? gap : undefined,
            }}
          >
            {renderItem(items[virtualItem.index] as T, virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  columns: number;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  gap?: number;
  getItemKey?: (index: number) => string | number;
}

/**
 * VirtualGrid - Virtualized grid layout for large datasets
 *
 * Renders items in a fixed-column grid with row virtualization.
 *
 * @example
 * ```tsx
 * <VirtualGrid
 *   items={files}
 *   columns={4}
 *   rowHeight={200}
 *   renderItem={(file) => <FileCard file={file} />}
 *   className="h-[600px]"
 * />
 * ```
 */
export function VirtualGrid<T>({
  items,
  renderItem,
  columns,
  rowHeight = 200,
  overscan = 2,
  className,
  gap = 8,
  getItemKey,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: rowHeight,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap,
              }}
            >
              {rowItems.map((item, colIndex) => {
                const itemIndex = startIndex + colIndex;
                return (
                  <div
                    key={getItemKey ? getItemKey(itemIndex) : itemIndex}
                    style={{ height: "100%" }}
                  >
                    {renderItem(item, itemIndex)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * useVirtualScroll - Low-level hook for custom virtualization
 *
 * Use when VirtualList/VirtualGrid don't fit your needs.
 */
export function useVirtualScroll<T extends Element>(
  options: Omit<VirtualizerOptions<T, Element>, "getScrollElement"> & {
    scrollElement: T | null;
  }
) {
  const { scrollElement, ...rest } = options;

  return useVirtualizer({
    ...rest,
    getScrollElement: () => scrollElement,
  });
}

export { useVirtualizer } from "@tanstack/react-virtual";
