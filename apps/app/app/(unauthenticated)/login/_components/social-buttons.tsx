"use client";

import { signIn } from "@repo/auth/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { getAbsoluteCallbackUrl } from "@/app/(unauthenticated)/_lib/callback-url";

type OAuthProvider = "google" | "github";

export function SocialButtons({
  callbackUrl,
  disabled = false,
}: {
  callbackUrl: string;
  disabled?: boolean;
}) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  const handleSocialSignIn = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);

    try {
      const authCallbackUrl = getAbsoluteCallbackUrl(callbackUrl);

      await signIn.social({
        provider,
        callbackURL: authCallbackUrl,
        errorCallbackURL: "/login",
      });
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
      setLoadingProvider(null);
    }
  };

  const isLoading = disabled || loadingProvider !== null;

  return (
    <div className="flex flex-col gap-3">
      <Button
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
        disabled={isLoading}
        onClick={() => handleSocialSignIn("google")}
        type="button"
        variant="outline"
      >
        {loadingProvider === "google" ? (
          <Spinner className="mr-2" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <Button
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
        disabled={isLoading}
        onClick={() => handleSocialSignIn("github")}
        type="button"
        variant="outline"
      >
        {loadingProvider === "github" ? (
          <Spinner className="mr-2" />
        ) : (
          <Icons.gitHub className="mr-2 h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
    </div>
  );
}
