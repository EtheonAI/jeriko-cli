"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forms";
import { AuthHeader } from "../components/auth-header";
import { AuthFooter } from "../components/auth-footer";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

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
          Forgot your password?
        </h1>
        <p className="text-sm text-neutral-400">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>
      </div>

      {/* Form */}
      <ForgotPasswordForm
        redirectTo="/reset-password"
        onSuccess={() => {
          // The form handles showing success state
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

export default function ForgotPasswordPage() {
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
          <ForgotPasswordContent />
        </Suspense>
      </main>

      <AuthFooter />
    </div>
  );
}
