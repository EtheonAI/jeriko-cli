import { KeyRound } from "lucide-react";
import Link from "next/link";
import { AuthPageShell } from "@/app/(unauthenticated)/_components/auth-page-shell";
import { ForgotPasswordForm } from "./_components/forgot-password-form";
import { getDefaultEmail } from "./_lib/default-email";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    email?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { email } = await searchParams;
  const defaultEmail = getDefaultEmail(email);

  return (
    <AuthPageShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Forgot your password?
          </h1>
          <p className="text-sm text-neutral-400">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <ForgotPasswordForm defaultEmail={defaultEmail} redirectTo="/reset-password" />

        <div className="text-center">
          <Link
            className="text-sm text-neutral-400 transition-colors hover:text-white"
            href="/login"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}
