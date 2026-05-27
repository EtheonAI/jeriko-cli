"use client";

import { sendVerificationEmail } from "@repo/auth/client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getAbsoluteCallbackUrl } from "@/app/(unauthenticated)/_lib/callback-url";

export function useVerifyEmail(email: string) {
  const [isPending, startTransition] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [resendCooldown]);

  function handleResend() {
    if (resendCooldown > 0 || !email) {
      return;
    }

    startTransition(async () => {
      const result = await sendVerificationEmail({
        email,
        callbackURL: getAbsoluteCallbackUrl("/"),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to resend verification email");
        return;
      }

      toast.success("Verification email sent");
      setResendCooldown(60);
    });
  }

  return {
    handleResend,
    isPending,
    resendCooldown,
  };
}
