import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";

const dashboardStats = [
  { label: "Workflows", value: "0" },
  { label: "Runs", value: "0" },
  { label: "Approvals", value: "0" },
] as const;

export function DashboardStats() {
  return (
    <section aria-label="Dashboard metrics" className="grid gap-3 md:grid-cols-3">
      {dashboardStats.map((stat) => (
        <Card className="gap-3 py-4 shadow-none" key={stat.label}>
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-2xl font-semibold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
