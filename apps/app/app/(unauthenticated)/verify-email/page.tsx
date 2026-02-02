"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@repo/design-system/components/ui/button";
import { sendVerificationEmail } from "@repo/auth/client";
import { AuthHeader } from "../components/auth-header";
import { AuthFooter } from "../components/auth-footer";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const [isPending, startTransition] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResend = () => {
    if (resendCooldown > 0 || !email) return;

    startTransition(async () => {
      const result = await sendVerificationEmail({
        email: decodeURIComponent(email),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to resend verification email");
        return;
      }

      toast.success("Verification email sent!");

      // Start cooldown timer (60 seconds)
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });
  };

  if (!email) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800">
          <Mail className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Check your email
        </h1>
        <p className="text-sm text-neutral-400">
          We sent a verification link to{" "}
          <span className="text-white">{decodeURIComponent(email)}</span>
        </p>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div className="text-sm text-neutral-300">
            <p className="font-medium mb-1">
              Click the link in your email to verify your account
            </p>
            <p className="text-neutral-400">
              The link will expire in 10 minutes. If you don't see the email,
              check your spam folder.
            </p>
          </div>
        </div>
      </div>

      {/* Resend Button */}
      <Button
        variant="outline"
        onClick={handleResend}
        disabled={isPending || resendCooldown > 0}
        className="w-full"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : resendCooldown > 0 ? (
          `Resend in ${resendCooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

      {/* Links */}
      <div className="flex flex-col gap-2 text-center">
        <Link
          href="/login"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Back to login
        </Link>
        <Link
          href="/login"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Use a different email
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
          <VerifyEmailContent />
        </Suspense>
      </main>

      <AuthFooter />
    </div>
  );
}
