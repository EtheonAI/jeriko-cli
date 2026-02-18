"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "../providers";
import { SocketProvider } from "@/lib/socket/provider";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ReduxDataLoader } from "./redux-data-loader";

export interface ServerUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface AuthenticatedProvidersProps {
  children: ReactNode;
  serverUser?: ServerUser;
}

/**
 * Client-side providers wrapper for authenticated routes.
 * Accepts serverUser from the RSC layout to avoid a redundant
 * client-side useSession() network request.
 */
export function AuthenticatedProviders({ children, serverUser }: AuthenticatedProvidersProps) {
  return (
    <StoreProvider>
      <TRPCProvider>
        <ReduxDataLoader serverUser={serverUser} />
        <SocketProvider>{children}</SocketProvider>
      </TRPCProvider>
    </StoreProvider>
  );
}
