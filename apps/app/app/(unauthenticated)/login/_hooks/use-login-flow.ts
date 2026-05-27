"use client";

import { sendVerificationEmail, signIn, signUp } from "@repo/auth/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  getAbsoluteCallbackUrl,
  getSafeCallbackUrl,
} from "@/app/(unauthenticated)/_lib/callback-url";
import {
  getNetworkErrorMessage,
  getSignInErrorResult,
  getSignUpErrorMessage,
} from "../_lib/auth-error-messages";
import {
  emailSchema,
  signInFormSchema,
  signUpFormSchema,
  type EmailFormData,
  type SignInFormData,
  type SignUpFormData,
} from "@/app/(unauthenticated)/_schemas/auth";
import type { AuthMode, AuthStep } from "../_types/login";

export function useLoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const [step, setStep] = useState<AuthStep>("email");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [resendCooldown]);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { password: "" },
  });

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { password: "" },
  });

  const isNewUser = mode === "sign-up";
  const watchedPassword =
    useWatch({
      control: signUpForm.control,
      name: "password",
    }) ?? "";

  function handleEmailSubmit(data: EmailFormData) {
    setEmail(data.email);
    signUpForm.reset({ password: "" });
    signInForm.reset({ password: "" });
    setStep("password");
  }

  function handleSignUp(data: SignUpFormData) {
    startTransition(async () => {
      try {
        const name = email.split("@")[0] ?? email;
        const authCallbackUrl = getAbsoluteCallbackUrl(callbackUrl);
        const result = await signUp.email({
          email,
          password: data.password,
          name,
          callbackURL: authCallbackUrl,
        });

        if (result.error) {
          toast.error(getSignUpErrorMessage(result.error));
          return;
        }

        toast.success("Account created. Please check your email to verify.");
        setStep("verify");
      } catch (error) {
        toast.error(getNetworkErrorMessage(error, "Failed to create account. Please try again."));
      }
    });
  }

  function handleSignIn(data: SignInFormData) {
    startTransition(async () => {
      try {
        const authCallbackUrl = getAbsoluteCallbackUrl(callbackUrl);
        const result = await signIn.email({
          email,
          password: data.password,
          callbackURL: authCallbackUrl,
        });

        if (result.error) {
          const errorResult = getSignInErrorResult(result.error);

          toast.error(errorResult.message);

          if (errorResult.nextStep) {
            setStep(errorResult.nextStep);
          }

          return;
        }

        toast.success("Signed in successfully");
        router.push(callbackUrl);
        router.refresh();
      } catch (error) {
        toast.error(getNetworkErrorMessage(error, "Something went wrong. Please try again."));
      }
    });
  }

  function handleResendVerification() {
    if (resendCooldown > 0 || !email) {
      return;
    }

    startTransition(async () => {
      const authCallbackUrl = getAbsoluteCallbackUrl(callbackUrl);
      const result = await sendVerificationEmail({
        email,
        callbackURL: authCallbackUrl,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to resend verification email");
        return;
      }

      toast.success("Verification email sent.");
      setResendCooldown(60);
    });
  }

  function handleEditEmail() {
    setStep("email");
    setMode("sign-in");
    setEmail("");
    setShowPassword(false);
    setResendCooldown(0);
    emailForm.reset();
    signUpForm.reset();
    signInForm.reset();
  }

  return {
    callbackUrl,
    email,
    emailForm,
    handleEditEmail,
    handleEmailSubmit,
    handleResendVerification,
    handleSignIn,
    handleSignUp,
    isNewUser,
    isPending,
    mode,
    resendCooldown,
    setMode,
    setShowPassword,
    showPassword,
    signInForm,
    signUpForm,
    step,
    watchedPassword,
  };
}
