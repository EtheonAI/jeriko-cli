"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboardIcon,
    href: "/",
  },
];

export function NavSection() {
  const pathname = usePathname();

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
              <Link href={item.href}>
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
