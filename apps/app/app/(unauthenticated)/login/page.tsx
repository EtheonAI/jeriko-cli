import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Suspense } from "react";
import { AuthPageShell } from "@/app/(unauthenticated)/_components/auth-page-shell";
import { legalLinks } from "@/app/(unauthenticated)/_lib/legal-links";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <Spinner className="h-6 w-6 text-white" />
          </div>
        }
      >
        <LoginForm legalLinks={legalLinks} />
      </Suspense>
    </AuthPageShell>
  );
}
