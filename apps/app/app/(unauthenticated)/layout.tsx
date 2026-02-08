import type React from "react";
import type { Metadata } from "next";
import { GlowingStarsBackground } from "./components/ui/glowing-stars";

export const metadata: Metadata = {
  title: {
    default: "Rubic - Sign In",
    template: "%s | Rubic",
  },
  description:
    "Sign in to Rubic — your AI-powered workspace for automation, smart home, and connected applications.",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <GlowingStarsBackground>{children}</GlowingStarsBackground>;
}
