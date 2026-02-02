"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { cn } from "@repo/design-system/lib/utils";
import { CrownIcon } from "lucide-react";

type UserAvatarSize = "sm" | "md" | "lg";

type UserAvatarProps = {
  user: {
    name: string | null;
    image?: string | null;
  };
  size?: UserAvatarSize;
  showBadge?: boolean;
  isPro?: boolean;
  className?: string;
};

const sizeClasses: Record<UserAvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
};

const badgeSizeClasses: Record<UserAvatarSize, string> = {
  sm: "h-3 w-3 -bottom-0.5 -right-0.5",
  md: "h-4 w-4 -bottom-0.5 -right-0.5",
  lg: "h-5 w-5 -bottom-1 -right-1",
};

const iconSizeClasses: Record<UserAvatarSize, string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

function getColorFromName(name: string | null): string {
  if (!name) return "hsl(220, 70%, 50%)";

  const colors = [
    "hsl(0, 70%, 50%)",    // red
    "hsl(25, 70%, 50%)",   // orange
    "hsl(45, 70%, 50%)",   // yellow
    "hsl(120, 70%, 40%)",  // green
    "hsl(180, 70%, 45%)",  // cyan
    "hsl(210, 70%, 50%)",  // blue
    "hsl(260, 70%, 55%)",  // purple
    "hsl(300, 70%, 50%)",  // pink
    "hsl(330, 70%, 50%)",  // magenta
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string | null): string {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function UserAvatar({
  user,
  size = "sm",
  showBadge = false,
  isPro = false,
  className,
}: UserAvatarProps) {
  const initials = getInitials(user.name);
  const backgroundColor = getColorFromName(user.name);

  return (
    <div className="relative inline-flex">
      <Avatar className={cn(sizeClasses[size], className)}>
        {user.image ? (
          <AvatarImage alt={user.name || "User"} src={user.image} />
        ) : null}
        <AvatarFallback
          style={{ backgroundColor }}
          className="text-white font-medium"
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {showBadge && isPro && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-background",
            badgeSizeClasses[size]
          )}
        >
          <CrownIcon className={iconSizeClasses[size]} />
        </span>
      )}
    </div>
  );
}
