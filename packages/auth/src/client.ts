import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [organizationClient()],
});

// Export commonly used hooks and methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  $Infer,
} = authClient;

// Re-export types
export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

// Organization types
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
