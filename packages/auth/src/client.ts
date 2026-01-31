"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const client = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [organizationClient()],
});

// Export the client
export const authClient = client;

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
} = client;

// Forgot password function - calls the API endpoint directly
export async function forgetPassword(options: {
  email: string;
  redirectTo?: string;
}): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseURL}/api/auth/forget-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: { message: errorData.message || "Failed to send reset email" },
      };
    }

    const data = await response.json().catch(() => ({}));
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "An error occurred. Please try again." },
    };
  }
}

// Session types
export type Session = typeof client.$Infer.Session;
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
