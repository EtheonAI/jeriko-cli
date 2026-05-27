import { emailSchema } from "@/app/(unauthenticated)/_schemas/auth";

type VerifyEmailSearchParams = {
  email?: string | string[];
};

export function getVerificationEmail({ email }: VerifyEmailSearchParams): string {
  const value = Array.isArray(email) ? email[0] : email;

  if (!value) {
    return "";
  }

  const result = emailSchema.safeParse({ email: value });

  if (!result.success) {
    return "";
  }

  return result.data.email;
}
