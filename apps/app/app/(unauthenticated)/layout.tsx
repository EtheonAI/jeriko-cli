import type React from "react"
import type { Metadata } from "next"
// import { Geist, Geist_Mono } from "next/font/google"
// import { Analytics } from "@vercel/analytics/next"
import { GlowingStarsBackground } from "./components/ui/glowing-stars"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
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
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <GlowingStarsBackground>{children}</GlowingStarsBackground>
  )
}


// import { ModeToggle } from "@repo/design-system/components/mode-toggle";
// import { CommandIcon } from "lucide-react";
// import type { ReactNode } from "react";

// type AuthLayoutProps = {
//   readonly children: ReactNode;
// };

// const AuthLayout = ({ children }: AuthLayoutProps) => (
//   <div className="container relative grid h-dvh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
//     <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
//       <div className="absolute inset-0 bg-muted" />
//       <div className="relative z-20 flex items-center font-medium text-lg text-primary">
//         <CommandIcon className="mr-2 h-6 w-6" />
//         Acme Inc
//       </div>
//       <div className="absolute top-4 right-4">
//         <ModeToggle />
//       </div>
//       <div className="relative z-20 mt-auto text-primary">
//         <blockquote className="space-y-2">
//           <p className="text-lg">
//             &ldquo;This library has saved me countless hours of work and helped
//             me deliver stunning designs to my clients faster than ever
//             before.&rdquo;
//           </p>
//           <footer className="text-sm">Sofia Davis</footer>
//         </blockquote>
//       </div>
//     </div>
//     <div className="lg:p-8">
//       <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-6">
//         {children}
//       </div>
//     </div>
//   </div>
// );

// export default AuthLayout;
