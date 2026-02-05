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
  BookOpenIcon,
  CodeIcon,
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
    title: "Applications",
    icon: Link2Icon,
    href: "/applications",
  },
  {
    title: "Knowledge",
    icon: BookOpenIcon,
    href: "/knowledge",
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
  {
    title: "Builder",
    icon: CodeIcon,
    href: "/website-builder",
  },
];

export function NavSection() {
  const pathname = usePathname();

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="px-4 text-sidebar-foreground/60">Platform</SidebarGroupLabel>
      <SidebarMenu className="px-2 gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive}
                className="h-9 px-2 gap-3 rounded-lg"
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
