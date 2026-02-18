"use client";

import dynamic from "next/dynamic";
import { useAppSelector } from "@/lib/store/hooks";

// Lazy-load SearchModal — only mounts when user opens search (Cmd+K).
// Saves importing CommandDialog, search result components, etc. at page load.
const SearchModal = dynamic(
  () => import("./search-modal").then((m) => ({ default: m.SearchModal })),
);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const isOpen = useAppSelector((s) => s.search.isOpen);

  return (
    <>
      {children}
      {isOpen && <SearchModal />}
    </>
  );
}
