"use client";

import Link from "next/link";
import { signOut } from "@repo/auth/client";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  CreditCardIcon,
  HelpCircleIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { useSettings } from "../settings/settings-context";
import { UserAvatar } from "../shared/user-avatar";

type UserInfo = {
  name: string | null;
  email: string;
  image: string | null;
};

type ProfileDropdownProps = {
  user: UserInfo;
  credits?: number;
  isPro?: boolean;
};

export function ProfileDropdown({
  user,
  credits = 0,
  isPro = false,
}: ProfileDropdownProps) {
  const { openSettings } = useSettings();

  return (
    <DropdownMenuContent align="end" className="w-64">
      <div className="flex items-start gap-3 p-3">
        <UserAvatar
          user={{ name: user.name, image: user.image }}
          size="md"
          showBadge
          isPro={isPro}
        />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-sm">{user.name || "User"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
            {user.email}
          </p>
          {isPro && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Pro
              </Badge>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
              >
                Add credits
              </Button>
            </div>
          )}
        </div>
      </div>

      <DropdownMenuSeparator />

      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Credits</span>
          <span className="text-sm font-medium">{credits.toLocaleString()}</span>
        </div>
      </div>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onSelect={() => openSettings("account")}
        >
          <UserIcon className="h-4 w-4" />
          <span>Account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onSelect={() => openSettings("settings")}
        >
          <SettingsIcon className="h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2">
            <HomeIcon className="h-4 w-4" />
            <span>Homepage</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help" className="flex items-center gap-2">
            <HelpCircleIcon className="h-4 w-4" />
            <span>Get help</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
        onSelect={async (event) => {
          event.preventDefault();
          await signOut({
            fetchOptions: {
              onSuccess: () => {
                window.location.href = "/login";
              },
            },
          });
        }}
      >
        <LogOutIcon className="h-4 w-4" />
        <span>Sign out</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
