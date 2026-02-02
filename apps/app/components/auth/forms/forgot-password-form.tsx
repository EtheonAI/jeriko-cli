"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { forgetPassword } from "@repo/auth/client";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "./validation-schemas";

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

const inputStyles =
  "h-11 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:ring-neutral-600";

export function ForgotPasswordForm({
  onSuccess,
  redirectTo = "/reset-password",
}: ForgotPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    startTransition(async () => {
      const result = await forgetPassword({
        email: data.email,
        redirectTo,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send reset email");
        return;
      }

      setSentEmail(data.email);
      setIsEmailSent(true);
      toast.success("Password reset email sent");
      onSuccess?.();
    });
  };

  if (isEmailSent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">Check your email</h3>
          <p className="mt-2 text-sm text-neutral-400">
            We sent a password reset link to{" "}
            <span className="text-white">{sentEmail}</span>
          </p>
        </div>
        <p className="text-xs text-neutral-500 text-center">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <button
            onClick={() => setIsEmailSent(false)}
            className="text-white underline hover:no-underline"
          >
            try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          disabled={isPending}
          className={`${inputStyles} ${errors.email ? "border-red-500" : ""}`}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-white text-black hover:bg-neutral-200"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
      </Button>
    </form>
  );
}
