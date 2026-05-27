"use client";

import { signOut } from "@repo/auth/client";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOut();

      if (result.error) {
        toast.error(result.error.message || "Failed to sign out");
        return;
      }

      router.push("/login");
      router.refresh();
    });
  }

  return (
    <SidebarMenuButton
      className="h-9 gap-3 rounded-[10px] ps-[9px] pe-[2px] [&>svg]:size-[18px]"
      disabled={isPending}
      onClick={handleSignOut}
      tooltip="Sign out"
    >
      {isPending ? <Spinner /> : <LogOutIcon />}
      <span className="text-sm">Sign out</span>
    </SidebarMenuButton>
  );
}
