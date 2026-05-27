import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Jeriko - Sign In",
    template: "%s | Jeriko",
  },
  description: "Sign in to Jeriko - your AI Workflow OS dashboard.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
