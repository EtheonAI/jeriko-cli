import { FieldDescription } from "@repo/design-system/components/ui/field";
import { Check, X } from "lucide-react";

export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 12 characters", valid: password.length >= 12 },
    { label: "Contains a letter", valid: /[a-zA-Z]/.test(password) },
    {
      label: "Contains a special character",
      valid: /[!@#$%^&*(),.?\":{}|<>]/.test(password),
    },
  ];

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      {checks.map((check) => (
        <FieldDescription
          className={`flex items-center gap-2 text-xs ${
            check.valid ? "text-green-500" : "text-neutral-500"
          }`}
          key={check.label}
        >
          {check.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          <span>{check.label}</span>
        </FieldDescription>
      ))}
    </div>
  );
}
