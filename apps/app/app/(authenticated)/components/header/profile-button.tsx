"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Button } from "@repo/design-system/components/ui/button";
import { UserAvatar } from "../shared/user-avatar";
import { ProfileDropdown } from "./profile-dropdown";

type UserInfo = {
  name: string | null;
  email: string;
  image: string | null;
};

type ProfileButtonProps = {
  user: UserInfo;
  credits?: number;
  isPro?: boolean;
};

export function ProfileButton({
  user,
  credits = 0,
  isPro = false,
}: ProfileButtonProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full" disabled>
        <UserAvatar
          user={{ name: user.name, image: user.image }}
          size="sm"
          showBadge
          isPro={isPro}
        />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserAvatar
            user={{ name: user.name, image: user.image }}
            size="sm"
            showBadge
            isPro={isPro}
          />
        </Button>
      </DropdownMenuTrigger>
      <ProfileDropdown user={user} credits={credits} isPro={isPro} />
    </DropdownMenu>
  );
}
