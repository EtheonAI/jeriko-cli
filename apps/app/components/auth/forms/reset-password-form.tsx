"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Check, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { resetPassword } from "@repo/auth/client";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "./validation-schemas";

interface ResetPasswordFormProps {
  token: string;
  onSuccess?: () => void;
}

const inputStyles =
  "h-11 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:ring-neutral-600";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 12 characters", valid: password.length >= 12 },
    { label: "Contains a letter", valid: /[a-zA-Z]/.test(password) },
    {
      label: "Contains a special character",
      valid: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      {checks.map((check, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 text-xs ${
            check.valid ? "text-green-500" : "text-neutral-500"
          }`}
        >
          {check.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          <span>{check.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [isReset, setIsReset] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

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
      onSuccess?.();
    });
  };

  if (isReset) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">
            Password reset successful
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            Your password has been reset. You can now sign in with your new
            password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password">New Password</Label>
        <div className="relative">
          <Input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a strong password"
            autoComplete="new-password"
            disabled={isPending}
            className={`${inputStyles} pr-14 ${errors.password ? "border-red-500" : ""}`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-sm"
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
        <PasswordStrength password={password || ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-confirm-password">Confirm Password</Label>
        <Input
          id="reset-confirm-password"
          type={showPassword ? "text" : "password"}
          placeholder="Confirm your password"
          autoComplete="new-password"
          disabled={isPending}
          className={`${inputStyles} ${errors.confirmPassword ? "border-red-500" : ""}`}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-white text-black hover:bg-neutral-200"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
      </Button>
    </form>
  );
}
