"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// Auth client configuration
const authClient = createAuthClient({
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
  requestPasswordReset,
  resetPassword,
  $Infer,
} = authClient;

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
