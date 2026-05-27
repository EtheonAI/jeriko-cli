import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { CheckCircle2, Mail } from "lucide-react";

type VerifyStepProps = {
  email: string;
  isPending: boolean;
  onEditEmail: () => void;
  onResendVerification: () => void;
  resendCooldown: number;
};

export function VerifyStep({
  email,
  isPending,
  onEditEmail,
  onResendVerification,
  resendCooldown,
}: VerifyStepProps) {
  return (
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
          Open the verification link sent to <span className="text-white">{email}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm text-neutral-300">
            <p className="mb-1 font-medium">Click the link in your email to verify your account</p>
            <p className="text-neutral-500">
              The link will expire in 10 minutes. If you do not see the email, check your spam
              folder.
            </p>
          </div>
        </div>
      </div>

      <Button
        className="h-11 w-full border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
        disabled={isPending || resendCooldown > 0}
        onClick={onResendVerification}
        variant="outline"
      >
        {isPending ? (
          <Spinner />
        ) : resendCooldown > 0 ? (
          `Resend in ${resendCooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

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
    </div>
  );
}
