"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  Link2Icon,
  ZapIcon,
  SmartphoneIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    title: "Library",
    icon: LayoutDashboardIcon,
    href: "/files",
  },
  {
    title: "Connections",
    icon: Link2Icon,
    href: "/applications",
  },
  {
    title: "Automations",
    icon: ZapIcon,
    href: "/actions",
  },
  {
    title: "Devices",
    icon: SmartphoneIcon,
    href: "/devices",
  },
];

export function NavSection() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-3 text-sidebar-foreground/60">
        Platform
      </SidebarGroupLabel>
      <SidebarMenu className="px-2 gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive}
                className="h-9 px-3 gap-3 rounded-[10px]"
              >
                <Link href={item.href}>
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className="text-[14px]">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
