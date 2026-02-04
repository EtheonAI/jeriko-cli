"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "../providers";
import { SocketProvider } from "@/lib/socket/provider";
import { TRPCProvider } from "@/lib/trpc/provider";

interface AuthenticatedProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for authenticated routes
 * This creates a proper client boundary for Redux and other client providers
 */
export function AuthenticatedProviders({ children }: AuthenticatedProvidersProps) {
  return (
    <StoreProvider>
      <TRPCProvider>
        <SocketProvider>{children}</SocketProvider>
      </TRPCProvider>
    </StoreProvider>
  );
}
