"use client";

import { SearchModal } from "./search-modal";

export function SearchProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SearchModal />
    </>
  );
}
