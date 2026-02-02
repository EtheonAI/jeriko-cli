import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { CalendarIcon, ListTodoIcon, ZapIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";

export const metadata: Metadata = {
  title: "Actions | Rubic",
  description: "Manage your tasks, actions, and schedules",
};

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
        {description}
      </p>
      <Button className="mt-6">{actionLabel}</Button>
    </div>
  );
}

export default async function ActionsPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return (
    <>
      <Header
        title="Actions"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Actions</h1>
          <p className="text-muted-foreground">
            Manage your tasks, actions, and scheduled automations
          </p>
        </div>

        <Tabs defaultValue="tasks" className="flex-1 flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodoIcon className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <ZapIcon className="h-4 w-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Schedules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="flex-1 flex flex-col mt-6">
            <EmptyState
              icon={ListTodoIcon}
              title="No tasks yet"
              description="Your active and completed tasks will appear here. Start a conversation to create your first task."
              actionLabel="Create task"
            />
          </TabsContent>

          <TabsContent value="actions" className="flex-1 flex flex-col mt-6">
            <EmptyState
              icon={ZapIcon}
              title="No actions configured"
              description="Actions are reusable workflows that can be triggered manually or automatically. Create your first action to automate repetitive tasks."
              actionLabel="Create action"
            />
          </TabsContent>

          <TabsContent value="schedules" className="flex-1 flex flex-col mt-6">
            <EmptyState
              icon={CalendarIcon}
              title="No schedules set"
              description="Schedule tasks to run automatically at specific times or intervals. Set up your first schedule to automate recurring work."
              actionLabel="Create schedule"
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
