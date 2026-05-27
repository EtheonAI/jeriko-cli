import { redirect } from "next/navigation";
import { AuthPageShell } from "@/app/(unauthenticated)/_components/auth-page-shell";
import { VerifyEmailContent } from "./_components/verify-email-content";
import { getVerificationEmail } from "./_lib/verification-email-query";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string | string[];
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const email = getVerificationEmail(await searchParams);

  if (!email) {
    redirect("/login");
  }

  return (
    <AuthPageShell>
      <VerifyEmailContent email={email} />
    </AuthPageShell>
  );
}
