import { AuthPageShell } from "@/app/(unauthenticated)/_components/auth-page-shell";
import { ResetPasswordContent } from "./_components/reset-password-content";
import { getResetPasswordQuery } from "./_lib/reset-password-query";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    token?: string | string[];
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const query = getResetPasswordQuery(await searchParams);

  return (
    <AuthPageShell>
      <ResetPasswordContent query={query} />
    </AuthPageShell>
  );
}
