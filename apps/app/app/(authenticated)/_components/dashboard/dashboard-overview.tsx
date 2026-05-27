import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { LayoutDashboardIcon } from "lucide-react";
import { DashboardStats } from "./dashboard-stats";

export function DashboardOverview() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Workspace overview</p>
      </section>

      <DashboardStats />

      <Empty className="min-h-[320px] bg-muted/20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutDashboardIcon />
          </EmptyMedia>
          <EmptyTitle>No workflows yet</EmptyTitle>
          <EmptyDescription>
            Workflow activity will appear here when the workflow module is enabled.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
