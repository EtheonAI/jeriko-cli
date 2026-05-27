import { Button } from "@repo/design-system/components/ui/button";
import { AlertCircle, KeyRound } from "lucide-react";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";
import {
  hasInvalidResetPasswordToken,
  type ResetPasswordQuery,
} from "../_lib/reset-password-query";

type ResetPasswordContentProps = {
  query: ResetPasswordQuery;
};

export function ResetPasswordContent({ query }: ResetPasswordContentProps) {
  if (hasInvalidResetPasswordToken(query)) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Invalid or expired link
          </h1>
          <p className="text-sm text-neutral-400">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/forgot-password">Request New Link</Link>
        </Button>

        <div className="text-center">
          <Link
            className="text-sm text-neutral-400 transition-colors hover:text-white"
            href="/login"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800">
          <KeyRound className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Create new password</h1>
        <p className="text-sm text-neutral-400">
          Choose a strong password that you haven&apos;t used before.
        </p>
      </div>

      <ResetPasswordForm token={query.token} />

      <div className="text-center">
        <Link className="text-sm text-neutral-400 transition-colors hover:text-white" href="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
