"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { LibraryBigIcon, ZapIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAppDispatch } from "@/lib/store/hooks";
import { setTabKey, type NavTabKey } from "@/lib/store/slices/navbar.slice";

const navItems = [
  {
    title: "Library",
    icon: LibraryBigIcon,
    href: "/files",
    tabKey: "files" as NavTabKey,
  },
  {
    title: "Automations",
    icon: ZapIcon,
    href: "/actions",
    tabKey: "scheduled" as NavTabKey,
  },
  {
    title: "Community",
    icon: UsersIcon,
    href: "/community",
    tabKey: "chat" as NavTabKey,
  },
];

/** Map pathname to NavTabKey */
function pathnameToTabKey(pathname: string): NavTabKey {
  if (pathname.startsWith("/files")) return "files";
  if (pathname.startsWith("/actions")) return "scheduled";
  if (pathname.startsWith("/community")) return "chat";
  if (pathname.startsWith("/chat")) return "task";
  if (pathname.startsWith("/devices")) return "devices";
  if (pathname.startsWith("/applications")) return "applications";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname === "/") return "newTask";
  return "task";
}

export function NavSection() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  // Sync active tab from pathname
  useEffect(() => {
    dispatch(setTabKey(pathnameToTabKey(pathname)));
  }, [pathname, dispatch]);

  return (
    <SidebarMenu className="gap-px">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={isActive}
              className="h-9 rounded-[10px] gap-3 ps-[9px] pe-[2px] [&>svg]:size-[18px]"
            >
              <Link href={item.href} onClick={() => dispatch(setTabKey(item.tabKey))}>
                <item.icon />
                <span className="text-sm">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
