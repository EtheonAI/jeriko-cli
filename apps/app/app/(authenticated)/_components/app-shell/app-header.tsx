import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { BetaBanner } from "./beta-banner";

type AppHeaderProps = {
  readonly betaFeature: boolean;
};

export function AppHeader({ betaFeature }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">Dashboard</span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          Workspace overview
        </span>
      </div>
      {betaFeature ? <BetaBanner /> : null}
    </header>
  );
}
