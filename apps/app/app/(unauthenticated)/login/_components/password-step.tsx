import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import Link from "next/link";
import type { FormEventHandler } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { PasswordStrength } from "@/app/(unauthenticated)/_components/forms/password-strength";
import { PasswordVisibilityButton } from "@/app/(unauthenticated)/_components/forms/password-visibility-button";

type PasswordStepProps = {
  email: string;
  isNewUser: boolean;
  isPending: boolean;
  onEditEmail: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onTogglePassword: () => void;
  passwordError?: string;
  passwordField: UseFormRegisterReturn<"password">;
  privacyUrl: string;
  showPassword: boolean;
  termsUrl: string;
  watchedPassword: string;
};

export function PasswordStep({
  email,
  isNewUser,
  isPending,
  onEditEmail,
  onSubmit,
  onTogglePassword,
  passwordError,
  passwordField,
  privacyUrl,
  showPassword,
  termsUrl,
  watchedPassword,
}: PasswordStepProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {isNewUser ? "Create your account" : "Enter your password"}
        </h1>
        <p className="text-sm text-neutral-400">
          {isNewUser ? "Set your password to continue" : "Welcome back"}
        </p>
      </div>

      <Field>
        <FieldLabel className="text-neutral-400">Email</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            className="h-11 flex-1 border-neutral-800 bg-neutral-900/50 text-neutral-400"
            disabled
            readOnly
            type="email"
            value={email}
          />
          <Button
            className="h-9 px-2 text-neutral-400 hover:text-white"
            onClick={onEditEmail}
            type="button"
            variant="ghost"
          >
            Edit
          </Button>
        </div>
      </Field>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            {!isNewUser && (
              <Link
                className="text-sm text-neutral-400 transition-colors hover:text-white"
                href={`/forgot-password?email=${encodeURIComponent(email)}`}
              >
                Forgot password?
              </Link>
            )}
          </div>
          <InputGroup
            className={`h-11 border-neutral-800 bg-neutral-900 dark:bg-neutral-900 ${
              passwordError ? "border-red-500" : ""
            }`}
          >
            <InputGroupInput
              aria-invalid={!!passwordError}
              autoComplete={isNewUser ? "new-password" : "current-password"}
              className="text-white placeholder:text-neutral-500"
              disabled={isPending}
              id="password"
              placeholder={isNewUser ? "Create a strong password" : "Enter your password"}
              type={showPassword ? "text" : "password"}
              {...passwordField}
            />
            <InputGroupAddon align="inline-end">
              <PasswordVisibilityButton
                disabled={isPending}
                isVisible={showPassword}
                onToggle={onTogglePassword}
              />
            </InputGroupAddon>
          </InputGroup>
          <FieldError className="text-xs text-red-500" errors={[{ message: passwordError }]} />
          {isNewUser && <PasswordStrength password={watchedPassword} />}
        </Field>

        <Button
          className="h-11 w-full bg-white text-black hover:bg-neutral-200"
          disabled={isPending}
          type="submit"
        >
          {isPending ? <Spinner /> : "Continue"}
        </Button>
      </form>

      <div className="text-center">
        <Button
          className="h-auto px-2 text-sm text-neutral-400 hover:text-white"
          onClick={onEditEmail}
          type="button"
          variant="ghost"
        >
          Back
        </Button>
      </div>

      {isNewUser && (
        <p className="text-center text-xs text-neutral-500">
          By creating an account, you agree to our{" "}
          <Link className="underline hover:text-white" href={termsUrl}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="underline hover:text-white" href={privacyUrl}>
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}
