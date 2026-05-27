"use client";

import { useLoginFlow } from "../_hooks/use-login-flow";
import { EmailStep } from "./email-step";
import { PasswordStep } from "./password-step";
import { VerifyStep } from "./verify-step";

type LoginFormProps = {
  legalLinks: {
    privacy: string;
    terms: string;
  };
};

export function LoginForm({ legalLinks }: LoginFormProps) {
  const login = useLoginFlow();

  const passwordForm = login.isNewUser ? login.signUpForm : login.signInForm;
  const handlePasswordSubmit = login.isNewUser
    ? login.signUpForm.handleSubmit(login.handleSignUp)
    : login.signInForm.handleSubmit(login.handleSignIn);

  return (
    <>
      {login.step === "email" && (
        <EmailStep
          callbackUrl={login.callbackUrl}
          emailForm={login.emailForm}
          mode={login.mode}
          onModeChange={login.setMode}
          onSubmit={login.handleEmailSubmit}
        />
      )}

      {login.step === "password" && (
        <PasswordStep
          email={login.email}
          isNewUser={login.isNewUser}
          isPending={login.isPending}
          onEditEmail={login.handleEditEmail}
          onSubmit={handlePasswordSubmit}
          onTogglePassword={() => login.setShowPassword((value) => !value)}
          passwordError={passwordForm.formState.errors.password?.message}
          passwordField={passwordForm.register("password")}
          privacyUrl={legalLinks.privacy}
          showPassword={login.showPassword}
          termsUrl={legalLinks.terms}
          watchedPassword={login.watchedPassword}
        />
      )}

      {login.step === "verify" && (
        <VerifyStep
          email={login.email}
          isPending={login.isPending}
          onEditEmail={login.handleEditEmail}
          onResendVerification={login.handleResendVerification}
          resendCooldown={login.resendCooldown}
        />
      )}
    </>
  );
}
