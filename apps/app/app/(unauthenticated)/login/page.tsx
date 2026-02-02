"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Check, X, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { signIn, signUp, sendVerificationEmail } from "@repo/auth/client";
import { Icons } from "@/components/icons";

import { AuthHeader } from "../components/auth-header";
import { AuthFooter } from "../components/auth-footer";

// Validation schemas
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least 1 letter")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least 1 special character");

const signUpFormSchema = z.object({
  password: passwordSchema,
});

const signInFormSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type EmailFormData = z.infer<typeof emailSchema>;
type SignUpFormData = z.infer<typeof signUpFormSchema>;
type SignInFormData = z.infer<typeof signInFormSchema>;

// Auth flow steps
type AuthStep = "email" | "password" | "verify";

// Input field styles (Manus-style with visible background)
const inputStyles = "h-11 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:ring-neutral-600";

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 12 characters", valid: password.length >= 12 },
    { label: "Contains a letter", valid: /[a-zA-Z]/.test(password) },
    { label: "Contains a special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
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

// Social login buttons
function SocialButtons({ disabled }: { disabled: boolean }) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);

  const isLoading = isGoogleLoading || isGitHubLoading || disabled;

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn.social({ provider: "google", callbackURL: "/" });
    } catch (error) {
      console.error("Google sign in error:", error);
      setIsGoogleLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsGitHubLoading(true);
    try {
      await signIn.social({ provider: "github", callbackURL: "/" });
    } catch (error) {
      console.error("GitHub sign in error:", error);
      setIsGitHubLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        onClick={handleGoogleSignIn}
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
      >
        {isGoogleLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        onClick={handleGitHubSignIn}
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
      >
        {isGitHubLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.gitHub className="mr-2 h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email form
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Sign up form
  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { password: "" },
  });

  // Sign in form
  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { password: "" },
  });

  const watchedPassword = isNewUser ? signUpForm.watch("password") : "";

  // Check if email exists
  async function handleEmailSubmit(data: EmailFormData) {
    setIsCheckingEmail(true);

    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email.toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error("Failed to check email");
      }

      const result = await response.json();
      const normalizedEmail = data.email.toLowerCase();

      setEmail(normalizedEmail);
      setIsNewUser(!result.exists);
      setStep("password");

      // Reset password forms
      signUpForm.reset({ password: "" });
      signInForm.reset({ password: "" });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCheckingEmail(false);
    }
  }

  // Handle sign up
  async function handleSignUp(data: SignUpFormData) {
    startTransition(async () => {
      // Use email prefix as default name
      const name = email.split("@")[0];

      const result = await signUp.email({
        email,
        password: data.password,
        name,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to create account");
        return;
      }

      toast.success("Account created! Please check your email to verify.");
      setStep("verify");
    });
  }

  // Handle sign in
  async function handleSignIn(data: SignInFormData) {
    startTransition(async () => {
      const result = await signIn.email({
        email,
        password: data.password,
      });

      if (result.error) {
        toast.error(result.error.message || "Invalid password");
        return;
      }

      toast.success("Signed in successfully");
      router.push("/");
      router.refresh();
    });
  }

  // Resend verification email
  const handleResendVerification = () => {
    if (resendCooldown > 0 || !email) return;

    startTransition(async () => {
      const result = await sendVerificationEmail({ email });

      if (result.error) {
        toast.error(result.error.message || "Failed to resend verification email");
        return;
      }

      toast.success("Verification email sent!");

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

  // Go back to email step
  const handleEditEmail = () => {
    setStep("email");
    setEmail("");
    setIsNewUser(false);
    emailForm.reset();
    signUpForm.reset();
    signInForm.reset();
  };

  // Step 1: Email entry
  const renderEmailStep = () => (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Sign in or sign up
        </h1>
        <p className="text-sm text-neutral-400">Start creating with Rubic</p>
      </div>

      <SocialButtons disabled={isCheckingEmail} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-black px-2 text-neutral-500">Or</span>
        </div>
      </div>

      <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isCheckingEmail}
            className={`${inputStyles} ${emailForm.formState.errors.email ? "border-red-500" : ""}`}
            {...emailForm.register("email")}
          />
          {emailForm.formState.errors.email && (
            <p className="text-xs text-red-500">{emailForm.formState.errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isCheckingEmail}
          className="h-11 w-full bg-white text-black hover:bg-neutral-200"
        >
          {isCheckingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </form>
    </div>
  );

  // Step 2: Password (sign up or sign in)
  const renderPasswordStep = () => {
    const form = isNewUser ? signUpForm : signInForm;
    const onSubmit = isNewUser ? handleSignUp : handleSignIn;

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

        {/* Email display */}
        <div className="flex flex-col gap-2">
          <Label className="text-neutral-400">Email</Label>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={email}
              readOnly
              disabled
              className="flex-1 h-11 bg-neutral-900/50 border-neutral-800 text-neutral-400"
            />
            <button
              type="button"
              onClick={handleEditEmail}
              className="text-sm text-neutral-400 hover:text-white transition-colors px-2"
            >
              Edit
            </button>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Password field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {!isNewUser && (
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(email)}`}
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={isNewUser ? "Create a strong password" : "Enter your password"}
                autoComplete={isNewUser ? "new-password" : "current-password"}
                disabled={isPending}
                className={`${inputStyles} pr-14 ${form.formState.errors.password ? "border-red-500" : ""}`}
                {...form.register("password")}
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
            {form.formState.errors.password && (
              <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
            )}
            {isNewUser && <PasswordStrength password={watchedPassword || ""} />}
          </div>

          <Button type="submit" disabled={isPending} className="h-11 w-full bg-white text-black hover:bg-neutral-200">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleEditEmail}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Back
          </button>
        </div>

        {isNewUser && (
          <p className="text-xs text-neutral-500 text-center">
            By creating an account, you agree to our{" "}
            <a href="/terms" className="underline hover:text-white">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </div>
    );
  };

  // Step 3: Verify email
  const renderVerifyStep = () => (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900">
          <Mail className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Verify your email address
        </h1>
        <p className="text-sm text-neutral-400">
          Enter the code sent to <span className="text-white">{email}</span> to complete verification.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div className="text-sm text-neutral-300">
            <p className="font-medium mb-1">Click the link in your email to verify your account</p>
            <p className="text-neutral-500">
              The link will expire in 10 minutes. If you don&apos;t see the email, check your spam folder.
            </p>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleResendVerification}
        disabled={isPending || resendCooldown > 0}
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : resendCooldown > 0 ? (
          `Resend in ${resendCooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={handleEditEmail}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
        {step === "email" && renderEmailStep()}
        {step === "password" && renderPasswordStep()}
        {step === "verify" && renderVerifyStep()}
      </main>

      <AuthFooter />
    </div>
  );
}
