"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { signIn, signUp } from "@repo/auth/client";
import { Icons } from "@/components/icons";

/**
 * OAuth Portal — /app-auth
 *
 * Webdev project users land here when clicking "Login" in their app.
 * URL: /app-auth?appId=...&redirectUri=...&state=...&type=signIn
 *
 * After authenticating (email/password or OAuth), this page:
 *   1. POSTs to /api/oauth/authorize to get an authorization code
 *   2. Redirects the user back to the webdev app's callback URL
 */
export default function AppAuthPage() {
  const params = useSearchParams();
  const appId = params.get("appId") || "";
  const redirectUri = params.get("redirectUri") || "";
  const state = params.get("state") || "";
  const authType = params.get("type") || "signIn";

  const [step, setStep] = useState<"login" | "signup" | "authorizing">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Validate required params
  const isValid = appId && redirectUri;

  // If user is already authenticated (has a Rubic session), auto-authorize
  useEffect(() => {
    if (!isValid) return;

    async function checkExistingSession() {
      try {
        const resp = await fetch("/api/auth/get-session", { credentials: "include" });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.session?.userId) {
            // User is already logged into Rubic — auto-authorize
            await issueCodeAndRedirect(data.session.userId, data.user?.name || "User", data.user?.email || "");
          }
        }
      } catch {
        // Not logged in, show login form
      }
    }

    checkExistingSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]);

  async function issueCodeAndRedirect(userId: string, userName: string, userEmail: string) {
    setStep("authorizing");
    try {
      const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "/api/oauth-proxy";
      const resp = await fetch("/api/oauth-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "authorize",
          userId,
          name: userName,
          email: userEmail,
          clientId: appId,
          redirectUri,
          state,
          platform: "email",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Authorization failed" }));
        setError(errData.error || "Authorization failed");
        setStep("login");
        return;
      }

      const data = await resp.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Failed to authorize. Please try again.");
      setStep("login");
    }
  }

  async function handleEmailSignIn() {
    setError("");
    startTransition(async () => {
      try {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || "Invalid email or password");
          return;
        }

        // Get user info from the session
        const sessionResp = await fetch("/api/auth/get-session", { credentials: "include" });
        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          await issueCodeAndRedirect(
            sessionData.session.userId,
            sessionData.user?.name || name || "User",
            sessionData.user?.email || email
          );
        }
      } catch {
        setError("Sign in failed. Please try again.");
      }
    });
  }

  async function handleEmailSignUp() {
    setError("");
    startTransition(async () => {
      try {
        const result = await signUp.email({ email, password, name: name || email.split("@")[0] || "User" });
        if (result.error) {
          setError(result.error.message || "Sign up failed");
          return;
        }

        // After signup, sign in and authorize
        const signInResult = await signIn.email({ email, password });
        if (signInResult.error) {
          setError("Account created but sign in failed. Please try again.");
          return;
        }

        const sessionResp = await fetch("/api/auth/get-session", { credentials: "include" });
        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          await issueCodeAndRedirect(
            sessionData.session.userId,
            sessionData.user?.name || name || "User",
            sessionData.user?.email || email
          );
        }
      } catch {
        setError("Sign up failed. Please try again.");
      }
    });
  }

  async function handleOAuthSignIn(provider: "google" | "github") {
    setError("");
    // For OAuth, we need to redirect back to this page after auth
    // Store the app-auth params in sessionStorage so we can resume after OAuth callback
    sessionStorage.setItem("rubic-oauth-appId", appId);
    sessionStorage.setItem("rubic-oauth-redirectUri", redirectUri);
    sessionStorage.setItem("rubic-oauth-state", state);

    try {
      await signIn.social({
        provider,
        callbackURL: `/app-auth?appId=${encodeURIComponent(appId)}&redirectUri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&type=signIn`,
      });
    } catch {
      setError(`${provider} sign in failed`);
    }
  }

  if (!isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141414] p-8 text-center">
          <h1 className="text-lg font-semibold text-white">Invalid Request</h1>
          <p className="mt-2 text-sm text-white/50">
            Missing required parameters (appId, redirectUri).
          </p>
        </div>
      </div>
    );
  }

  if (step === "authorizing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141414] p-8 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-blue-500" />
          <p className="mt-4 text-sm text-white/60">Authorizing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141414] p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Icons.logo className="size-6 text-blue-500" />
          </div>
          <h1 className="text-lg font-semibold text-white">
            {step === "signup" ? "Create Account" : "Sign In"}
          </h1>
          <p className="mt-1 text-xs text-white/40">
            Sign in with your Rubic account to continue
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* OAuth buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Icons.google className="size-4" />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuthSignIn("github")}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Icons.gitHub className="size-4" />
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/30">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "signup") {
              handleEmailSignUp();
            } else {
              handleEmailSignIn();
            }
          }}
          className="space-y-3"
        >
          {step === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={step === "signup" ? 12 : 1}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={isPending || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            {step === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle login/signup */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setStep(step === "signup" ? "login" : "signup");
              setError("");
            }}
            className="text-xs text-blue-400 hover:underline"
          >
            {step === "signup"
              ? "Already have an account? Sign in"
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
