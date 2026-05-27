"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword } from "@repo/auth/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { inputStyles } from "@/app/(unauthenticated)/_components/forms/form-styles";
import { PasswordStrength } from "@/app/(unauthenticated)/_components/forms/password-strength";
import { PasswordVisibilityButton } from "@/app/(unauthenticated)/_components/forms/password-visibility-button";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "@/app/(unauthenticated)/_schemas/auth";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [isReset, setIsReset] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password =
    useWatch({
      control,
      name: "password",
    }) ?? "";

  const onSubmit = (data: ResetPasswordFormData) => {
    startTransition(async () => {
      const result = await resetPassword({
        newPassword: data.password,
        token,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to reset password");
        return;
      }

      setIsReset(true);
      toast.success("Password reset successfully");
    });
  };

  if (isReset) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">Password reset successful</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Your password has been reset. You can now sign in with your new password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Field>
        <FieldLabel htmlFor="reset-password">New Password</FieldLabel>
        <InputGroup
          className={`h-11 border-neutral-800 bg-neutral-900 dark:bg-neutral-900 ${
            errors.password ? "border-red-500" : ""
          }`}
        >
          <InputGroupInput
            aria-invalid={!!errors.password}
            autoComplete="new-password"
            className="text-white placeholder:text-neutral-500"
            disabled={isPending}
            id="reset-password"
            placeholder="Create a strong password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
          />
          <InputGroupAddon align="inline-end">
            <PasswordVisibilityButton
              disabled={isPending}
              isVisible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
          </InputGroupAddon>
        </InputGroup>
        <FieldError className="text-xs text-red-500" errors={[errors.password]} />
        <PasswordStrength password={password} />
      </Field>

      <Field>
        <FieldLabel htmlFor="reset-confirm-password">Confirm Password</FieldLabel>
        <Input
          aria-invalid={!!errors.confirmPassword}
          autoComplete="new-password"
          className={inputStyles}
          disabled={isPending}
          id="reset-confirm-password"
          placeholder="Confirm your password"
          type={showPassword ? "text" : "password"}
          {...register("confirmPassword")}
        />
        <FieldError className="text-xs text-red-500" errors={[errors.confirmPassword]} />
      </Field>

      <Button
        className="h-11 w-full bg-white text-black hover:bg-neutral-200"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Spinner /> : "Reset Password"}
      </Button>
    </form>
  );
}
