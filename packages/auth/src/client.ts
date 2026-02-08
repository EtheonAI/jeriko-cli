"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// Auth client configuration
const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [organizationClient()],
});

// Export client instance
export { authClient };

// Export auth methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  sendVerificationEmail,
  resetPassword,
  $Infer,
} = authClient;

// forgetPassword exists at runtime but TypeScript can't infer it when plugins are added.
// Access it directly from the client instance.
export const forgetPassword = (authClient as any).forgetPassword as (options: {
  email: string;
  redirectTo?: string;
}) => Promise<{ data: unknown; error: { message: string } | null }>;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Member = {
  id: string;
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
  createdAt: Date;
};
