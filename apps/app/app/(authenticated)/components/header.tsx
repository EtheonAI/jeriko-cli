import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";

type HeaderProps = {
  pages?: string[];
  page?: string;
  title?: string;
  version?: string;
  children?: ReactNode;
};

export const Header = ({
  title = "Rubic",
  version = "1.0",
  children,
}: HeaderProps) => (
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
    </div>
  </header>
);
