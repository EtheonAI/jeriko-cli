"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useVerifyEmail } from "../_hooks/use-verify-email";

type VerifyEmailContentProps = {
  email: string;
};

export function VerifyEmailContent({ email }: VerifyEmailContentProps) {
  const { handleResend, isPending, resendCooldown } = useVerifyEmail(email);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800">
          <Mail className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Check your email</h1>
        <p className="text-sm text-neutral-400">
          We sent a verification link to <span className="text-white">{email}</span>
        </p>
      </div>

      <div className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm text-neutral-300">
            <p className="mb-1 font-medium">Click the link in your email to verify your account</p>
            <p className="text-neutral-400">
              The link will expire in 10 minutes. If you don&apos;t see the email, check your spam
              folder.
            </p>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        disabled={isPending || resendCooldown > 0}
        onClick={handleResend}
        variant="outline"
      >
        {isPending ? (
          <Spinner />
        ) : resendCooldown > 0 ? (
          `Resend in ${resendCooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

      <div className="flex flex-col gap-2 text-center">
        <Link className="text-sm text-neutral-400 transition-colors hover:text-white" href="/login">
          Back to login
        </Link>
        <Link className="text-sm text-neutral-400 transition-colors hover:text-white" href="/login">
          Use a different email
        </Link>
      </div>
    </div>
  );
}
