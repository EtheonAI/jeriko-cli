"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { CreditsButton } from "./credits-button";
import { NotificationsButton } from "./notifications-button";
import { ProfileButton } from "./profile-button";

type UserInfo = {
  name: string | null;
  email: string;
  image: string | null;
};

type HeaderProps = {
  title?: string;
  version?: string;
  user?: UserInfo;
  credits?: number;
  isPro?: boolean;
  children?: ReactNode;
};

export function Header({
  title = "Rubic",
  version = "1.0",
  user,
  credits = 0,
  isPro = false,
  children,
}: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">{title}</span>
          <Badge variant="secondary" className="text-xs font-normal">
            v{version}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <CreditsButton credits={credits} isPro={isPro} />
        <NotificationsButton />
        {user && (
          <ProfileButton user={user} credits={credits} isPro={isPro} />
        )}
      </div>
    </header>
  );
}

export { CreditsButton } from "./credits-button";
export { NotificationsButton } from "./notifications-button";
export { ProfileButton } from "./profile-button";
