"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { PlusIcon, CodeIcon, FileIcon, Trash2Icon } from "lucide-react";
import { NewProjectDialog } from "./new-project-dialog";

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

const frameworkLabels: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idle: "secondary",
  building: "default",
  deployed: "outline",
  failed: "destructive",
};

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: projects, isLoading } = trpc.websiteBuilder.projectsList.useQuery();
  const utils = trpc.useUtils();
  const deleteProject = trpc.websiteBuilder.projectsDelete.useMutation({
    onSuccess: () => {
      utils.websiteBuilder.projectsList.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-4 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const projectList = projects ?? [];

  return (
    <>
      {projectList.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-muted p-6">
            <CodeIcon className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to get started building.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            className="flex cursor-pointer items-center justify-center border-dashed transition-colors hover:border-primary hover:bg-accent/50"
            onClick={() => setDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center gap-2 py-8">
              <PlusIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">New Project</span>
            </CardContent>
          </Card>

          {projectList.map(({ project, fileCount }) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30"
              onClick={() => onSelectProject(project.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject.mutate({ id: project.id });
                    }}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[project.status] ?? "secondary"}>
                    {project.status}
                  </Badge>
                  <Badge variant="outline">
                    {frameworkLabels[project.framework] ?? project.framework}
                  </Badge>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <FileIcon className="h-3 w-3" />
                    {fileCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSelectProject={onSelectProject}
      />
    </>
  );
}
