"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderIcon,
  MessageSquareIcon,
  SettingsIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  useGetProjectQuery,
  useGetProjectSessionsQuery,
} from "@/lib/store/api/api.slice";
import {
  type Project,
} from "@/lib/store/slices/projects.slice";
import { CreateProjectDialog } from "../../components/projects/create-project-dialog";
import { ProjectChatSection } from "./components/project-chat-section";

type ProjectDetailClientProps = {
  projectId: string;
};

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch project + sessions via RTK Query
  const { data: projectData, isLoading: isLoadingProject } = useGetProjectQuery(projectId);
  const { data: sessionsData, isLoading: isLoadingSessions } = useGetProjectSessionsQuery({ projectId });
  const project = (projectData as any) ?? null;
  const sessions = (sessionsData as any[] | null) ?? null;

  // Loading state
  if (isLoadingProject) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
          <Skeleton className="size-14 rounded-2xl" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-[120px] w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="text-center space-y-2">
          <FolderIcon className="size-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-lg font-medium">Project not found</h2>
          <p className="text-sm text-muted-foreground">
            This project may have been deleted or you don&apos;t have access.
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </main>
    );
  }

  // Map DB project to Redux Project type for the edit dialog
  const projectForEdit: Project = {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description ?? undefined,
    icon: project.icon ?? undefined,
    color: project.color ?? undefined,
    type: "general",
    status: project.status as Project["status"],
    members: [],
    settings: {
      isPublic: project.visibility !== "private",
      allowComments: true,
      notifyOnUpdate: true,
      connectorIds: (project.settings as any)?.connectorIds ?? [],
    },
    sessionCount: sessions?.length ?? 0,
    fileCount: 0,
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
  };

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl -mt-16">
          {/* Project hero — mirrors dashboard layout */}
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: project.color
                    ? `${project.color}15`
                    : "hsl(var(--muted))",
                }}
              >
                {project.icon ? (
                  <span className="text-2xl">{project.icon}</span>
                ) : (
                  <FolderIcon
                    className="size-7"
                    style={project.color ? { color: project.color } : undefined}
                  />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {project.description || `What would you like to do in this project?`}
            </p>
          </div>

          {/* Chat prompt — main interaction */}
          <ProjectChatSection
            projectId={projectId}
            projectName={project.name}
          />

          {/* Recent tasks + settings row */}
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {sessions && sessions.length > 0
                  ? `${sessions.length} task${sessions.length !== 1 ? "s" : ""}`
                  : "No tasks yet"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowEditDialog(true)}
              >
                <SettingsIcon className="size-3.5 mr-1" />
                Settings
              </Button>
            </div>
            {isLoadingSessions ? (
              <div className="space-y-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div className="space-y-0.5">
                {sessions.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => router.push(`/chat/${s.id}`)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <MessageSquareIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm truncate flex-1">
                      {s.title || "Untitled task"}
                    </p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))}
                {sessions.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{sessions.length - 5} more
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Edit project dialog */}
      <CreateProjectDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editProject={projectForEdit}
      />
    </>
  );
}
