import { emailSchema } from "@/app/(unauthenticated)/_schemas/auth";

export function getDefaultEmail(email: string | string[] | undefined) {
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
