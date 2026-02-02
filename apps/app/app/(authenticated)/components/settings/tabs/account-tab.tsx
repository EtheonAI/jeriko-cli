"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { UserAvatar } from "../../shared/user-avatar";

type AccountTabProps = {
  user?: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

export function AccountTab({ user }: AccountTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and profile information.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Profile</h3>

        <div className="flex items-center gap-4">
          <UserAvatar
            user={{ name: user?.name ?? null, image: user?.image }}
            size="lg"
          />
          <div className="space-y-1">
            <Button variant="outline" size="sm">
              Change avatar
            </Button>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or GIF. Max 2MB.
            </p>
          </div>
        </div>

        <div className="grid gap-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              defaultValue={user?.name || ""}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user?.email || ""}
              placeholder="Enter your email"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Password</h3>
        <p className="text-sm text-muted-foreground">
          Update your password to keep your account secure.
        </p>

        <div className="grid gap-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
            />
          </div>

          <Button className="w-fit">Update password</Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <Button variant="destructive" size="sm">
          Delete account
        </Button>
      </div>
    </div>
  );
}
