"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, KeyRound, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@repo/design-system/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/forms";
import { AuthHeader } from "../components/auth-header";
import { AuthFooter } from "../components/auth-footer";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // If no token, show error state
  if (!token) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Invalid or expired link
          </h1>
          <p className="text-sm text-neutral-400">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
        </div>

        {/* Action */}
        <Button
          onClick={() => router.push("/forgot-password")}
          className="w-full"
        >
          Request New Link
        </Button>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800">
          <KeyRound className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Create new password
        </h1>
        <p className="text-sm text-neutral-400">
          Choose a strong password that you haven't used before.
        </p>
      </div>

      {/* Form */}
      <ResetPasswordForm
        token={token}
        onSuccess={() => {
          router.push("/login");
        }}
      />

      {/* Back Link */}
      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </main>

      <AuthFooter />
    </div>
  );
}
