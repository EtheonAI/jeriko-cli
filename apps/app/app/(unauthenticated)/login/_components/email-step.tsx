import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import type { SubmitHandler, UseFormReturn } from "react-hook-form";
import { inputStyles } from "@/app/(unauthenticated)/_components/forms/form-styles";
import type { EmailFormData } from "@/app/(unauthenticated)/_schemas/auth";
import type { AuthMode } from "../_types/login";
import { SocialButtons } from "./social-buttons";

type EmailStepProps = {
  callbackUrl: string;
  emailForm: UseFormReturn<EmailFormData>;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: SubmitHandler<EmailFormData>;
};

export function EmailStep({
  callbackUrl,
  emailForm,
  mode,
  onModeChange,
  onSubmit,
}: EmailStepProps) {
  const emailError = emailForm.formState.errors.email?.message;
  const isSignIn = mode === "sign-in";
  const handleModeChange = (value: string) => {
    if (value === "sign-in" || value === "sign-up") {
      onModeChange(value);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {isSignIn ? "Sign in" : "Create your account"}
        </h1>
        <p className="text-sm text-neutral-400">Start creating with Jeriko</p>
      </div>

      <SocialButtons callbackUrl={callbackUrl} />

      <ToggleGroup
        className="grid w-full grid-cols-2 rounded-lg border border-neutral-800 bg-neutral-950 p-1"
        onValueChange={handleModeChange}
        type="single"
        value={mode}
      >
        <ToggleGroupItem
          className="h-9 w-full rounded-md text-neutral-400 data-[state=on]:bg-neutral-800 data-[state=on]:text-white"
          value="sign-in"
        >
          Sign in
        </ToggleGroupItem>
        <ToggleGroupItem
          className="h-9 w-full rounded-md text-neutral-400 data-[state=on]:bg-neutral-800 data-[state=on]:text-white"
          value="sign-up"
        >
          Sign up
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-black px-2 text-neutral-500">Or</span>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={emailForm.handleSubmit(onSubmit)}>
        <Field>
          <FieldLabel className="sr-only" htmlFor="email">
            Email
          </FieldLabel>
          <Input
            aria-invalid={!!emailError}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            className={inputStyles}
            id="email"
            placeholder="Enter your email address"
            type="email"
            {...emailForm.register("email")}
          />
          <FieldError className="text-xs text-red-500" errors={[{ message: emailError }]} />
        </Field>

        <Button className="h-11 w-full bg-white text-black hover:bg-neutral-200" type="submit">
          Continue
        </Button>
      </form>
    </div>
  );
}
