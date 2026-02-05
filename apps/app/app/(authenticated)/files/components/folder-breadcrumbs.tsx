"use client";

import { ChevronRightIcon, HomeIcon } from "lucide-react";

interface FolderBreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function FolderBreadcrumbs({ currentPath, onNavigate }: FolderBreadcrumbsProps) {
  const segments = currentPath === "/" ? [] : currentPath.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate("/")}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <HomeIcon className="h-3.5 w-3.5" />
        Files
      </button>
      {segments.map((segment, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <div key={path} className="flex items-center gap-1">
            <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => onNavigate(path)}
              className={
                isLast
                  ? "rounded px-1.5 py-0.5 font-medium"
                  : "rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              }
            >
              {segment}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
