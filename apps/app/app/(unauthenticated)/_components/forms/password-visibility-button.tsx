import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";

type PasswordVisibilityButtonProps = {
  disabled?: boolean;
  isVisible: boolean;
  onToggle: () => void;
};

export function PasswordVisibilityButton({
  disabled,
  isVisible,
  onToggle,
}: PasswordVisibilityButtonProps) {
  const Icon = isVisible ? EyeOffIcon : EyeIcon;
  const label = isVisible ? "Hide password" : "Show password";

  return (
    <InputGroupButton
      aria-label={label}
      className="text-neutral-400 hover:text-white"
      disabled={disabled}
      onClick={onToggle}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </InputGroupButton>
  );
}
