"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset } from "@repo/auth/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { inputStyles } from "@/app/(unauthenticated)/_components/forms/form-styles";
import { getAbsoluteCallbackUrl } from "@/app/(unauthenticated)/_lib/callback-url";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/app/(unauthenticated)/_schemas/auth";

type ForgotPasswordFormProps = {
  defaultEmail?: string;
  redirectTo?: string;
};

export function ForgotPasswordForm({
  defaultEmail = "",
  redirectTo = "/reset-password",
}: ForgotPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: defaultEmail,
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    startTransition(async () => {
      const result = await requestPasswordReset({
        email: data.email,
        redirectTo: getAbsoluteCallbackUrl(redirectTo),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send reset email");
        return;
      }

      setSentEmail(data.email);
      toast.success("Password reset email sent");
    });
  };

  if (sentEmail) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">Check your email</h3>
          <p className="mt-2 text-sm text-neutral-400">
            We sent a password reset link to <span className="text-white">{sentEmail}</span>
          </p>
        </div>
        <p className="text-center text-xs text-neutral-500">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <Button
            className="h-auto p-0 text-xs text-white underline hover:no-underline"
            onClick={() => setSentEmail("")}
            type="button"
            variant="link"
          >
            try again
          </Button>
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Field>
        <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
        <Input
          aria-invalid={!!errors.email}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          className={inputStyles}
          disabled={isPending}
          id="forgot-email"
          placeholder="you@example.com"
          type="email"
          {...register("email")}
        />
        <FieldError className="text-xs text-red-500" errors={[errors.email]} />
      </Field>

      <Button
        className="h-11 w-full bg-white text-black hover:bg-neutral-200"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Spinner /> : "Send Reset Link"}
      </Button>
    </form>
  );
}
