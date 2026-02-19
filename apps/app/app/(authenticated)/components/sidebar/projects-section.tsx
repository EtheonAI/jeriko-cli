"use client";

import { useState, useCallback, memo } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@repo/design-system/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  ChevronUpIcon,
  PlusIcon,
  FolderIcon,
  EllipsisIcon,
  PinIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { deleteProject, updateProject } from "@/lib/store/slices/projects.slice";
import { useUpdateProjectMutation, useDeleteProjectMutation } from "@/lib/store/api/api.slice";
import { toast } from "sonner";
import { CreateProjectDialog } from "../projects/create-project-dialog";
import type { Project } from "@/lib/store/slices/projects.slice";

const ProjectItem = memo(function ProjectItem({
  project,
  isActive,
  onEdit,
}: {
  project: Project;
  isActive: boolean;
  onEdit: (project: Project) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [updateProjectMutation] = useUpdateProjectMutation();
  const [deleteProjectMutation] = useDeleteProjectMutation();

  const handlePin = useCallback(() => {
    const currentlyPinned = (project as any).isPinned ?? false;
    dispatch(
      updateProject({
        id: project.id,
        updates: { settings: { ...project.settings, isPinned: !currentlyPinned } as any },
      })
    );
    toast.success(currentlyPinned ? "Unpinned" : "Pinned");
    updateProjectMutation({ id: project.id, isPinned: !currentlyPinned } as any)
      .unwrap()
      .catch(() => {
        dispatch(
          updateProject({
            id: project.id,
            updates: { settings: { ...project.settings, isPinned: currentlyPinned } as any },
          })
        );
        toast.error("Failed to update pin");
      });
  }, [project, dispatch, updateProjectMutation]);

  const handleDelete = useCallback(() => {
    dispatch(deleteProject(project.id));
    setShowDeleteDialog(false);
    toast.success("Project deleted");
    if (isActive) {
      router.push("/");
    }
    deleteProjectMutation(project.id)
      .unwrap()
      .catch(() => {
        toast.error("Failed to delete project");
      });
  }, [project.id, dispatch, isActive, router, deleteProjectMutation]);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={project.name}
          className="h-9 rounded-[10px] gap-3 ps-2 pe-[2px] [&>svg]:size-[18px]"
        >
          <Link href={`/projects/${project.id}`}>
            {project.icon ? (
              <span className="text-sm shrink-0">{project.icon}</span>
            ) : (
              <FolderIcon
                className="text-sidebar-foreground/60"
                style={project.color ? { color: project.color } : undefined}
              />
            )}
            <span className="text-sm truncate">{project.name}</span>
          </Link>
        </SidebarMenuButton>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="right-[2px] size-8 rounded-lg hover:bg-sidebar-accent/60 [&>svg]:size-[18px] data-[state=open]:opacity-100"
            >
              <EllipsisIcon className="text-sidebar-foreground/40" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={handlePin} className="gap-2">
              <PinIcon className="size-4" />
              {(project as any).isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEdit(project)}
              className="gap-2"
            >
              <PencilIcon className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2Icon className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{project.name}&rdquo; and remove all
              session associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export function ProjectsSection() {
  const [open, setOpen] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const projects = useAppSelector((state) => state.projects.projects);
  const pathname = usePathname();

  const handleCreateProject = useCallback(() => {
    setEditProject(null);
    setShowCreateDialog(true);
  }, []);

  const handleEditProject = useCallback((project: Project) => {
    setEditProject(project);
    setShowCreateDialog(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      setEditProject(null);
    }
  }, []);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="group/projects">
        <SidebarGroup className="p-0 pt-[11px]">
          <SidebarGroupLabel
            asChild
            className="h-9 px-[10px] text-[13px] font-medium text-sidebar-foreground/50 tracking-tight cursor-pointer hover:bg-sidebar-accent/50 rounded-[10px] transition-colors"
          >
            <CollapsibleTrigger className="flex items-center w-full">
              <span className="flex-1 min-w-0 truncate text-left">Projects</span>
              <ChevronUpIcon
                className={`size-3.5 text-sidebar-foreground/40 transition-all shrink-0 opacity-0 group-hover/projects:opacity-100 ${
                  !open ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>

          <SidebarGroupAction
            title="Create project"
            onClick={handleCreateProject}
            className="top-[15px] right-[2px] size-8 rounded-lg hover:bg-sidebar-accent/60 [&>svg]:size-[18px]"
          >
            <PlusIcon className="text-sidebar-foreground/40" />
          </SidebarGroupAction>

          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {(projects ?? []).length === 0 ? (
                  <li className="px-[10px] py-2">
                    <span className="text-xs text-sidebar-foreground/30">
                      No projects yet
                    </span>
                  </li>
                ) : (
                  (projects ?? []).map((project) => {
                    const isActive = pathname === `/projects/${project.id}`;
                    return (
                      <ProjectItem
                        key={project.id}
                        project={project}
                        isActive={isActive}
                        onEdit={handleEditProject}
                      />
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={handleDialogClose}
        editProject={editProject}
      />
    </>
  );
}
