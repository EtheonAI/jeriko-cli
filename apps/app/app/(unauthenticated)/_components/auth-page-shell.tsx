import type { ReactNode } from "react";
import { AuthFooter } from "./auth-footer";
import { AuthHeader } from "./auth-header";

type AuthPageShellProps = {
  children: ReactNode;
};

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <AuthHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
        {children}
      </main>

      <AuthFooter />
    </div>
  );
}
