"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@repo/design-system/components/ui/resizable";
import { Toolbar } from "./toolbar";
import { FileTree } from "./file-tree";
import { EditorTabs } from "./editor-tabs";
import { CodeEditor } from "./code-editor";
import { PreviewPanel } from "./preview-panel";
import { DeployDialog } from "./deploy-dialog";
import { AiGeneratePanel } from "./ai-generate-panel";
import { FileIcon } from "lucide-react";

interface BuilderLayoutProps {
  projectId: string;
  onBack: () => void;
}

interface OpenTab {
  id: string;
  name: string;
}

export function BuilderLayout({ projectId, onBack }: BuilderLayoutProps) {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [deployOpen, setDeployOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const { data: projectData, isLoading: projectLoading } = trpc.websiteBuilder.projectsGet.useQuery(
    { id: projectId }
  );
  const { data: files, isLoading: filesLoading } = trpc.websiteBuilder.filesList.useQuery({
    projectId,
  });
  const { data: activeFile } = trpc.websiteBuilder.filesGet.useQuery(
    { id: activeFileId! },
    { enabled: !!activeFileId }
  );

  const utils = trpc.useUtils();

  const createFile = trpc.websiteBuilder.filesCreate.useMutation({
    onSuccess: () => {
      utils.websiteBuilder.filesList.invalidate({ projectId });
    },
  });

  const deleteFile = trpc.websiteBuilder.filesDelete.useMutation({
    onSuccess: (_, variables) => {
      utils.websiteBuilder.filesList.invalidate({ projectId });
      // Remove from tabs if open
      setOpenTabs((tabs) => tabs.filter((t) => t.id !== variables.id));
      if (activeFileId === variables.id) {
        setActiveFileId(null);
      }
    },
  });

  const handleSelectFile = useCallback(
    (fileId: string) => {
      const file = files?.find((f) => f.id === fileId);
      if (!file || file.isDirectory) return;

      setActiveFileId(fileId);
      setOpenTabs((tabs) => {
        if (tabs.some((t) => t.id === fileId)) return tabs;
        return [...tabs, { id: fileId, name: file.name }];
      });
    },
    [files]
  );

  const handleCloseTab = useCallback(
    (fileId: string) => {
      setOpenTabs((tabs) => {
        const newTabs = tabs.filter((t) => t.id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(newTabs.length > 0 ? newTabs[newTabs.length - 1]!.id : null);
        }
        return newTabs;
      });
    },
    [activeFileId]
  );

  const handleCreateFile = useCallback(
    (path: string, name: string, isDirectory: boolean) => {
      createFile.mutate({ projectId, path, name, isDirectory });
    },
    [projectId, createFile]
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      deleteFile.mutate({ id: fileId });
    },
    [deleteFile]
  );

  if (projectLoading || filesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Project not found</div>
      </div>
    );
  }

  const project = projectData.project;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Toolbar
        projectName={project.name}
        framework={project.framework}
        onBack={onBack}
        onGenerate={() => setGenerateOpen(true)}
        onDeploy={() => setDeployOpen(true)}
      />

      <ResizablePanelGroup direction="horizontal" autoSaveId="website-builder" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} collapsible className="bg-muted/20">
          <FileTree
            files={
              files?.map((f) => ({
                id: f.id,
                path: f.path,
                name: f.name,
                isDirectory: f.isDirectory,
                language: f.language,
              })) ?? []
            }
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex h-full flex-col">
            <EditorTabs
              tabs={openTabs}
              activeTabId={activeFileId}
              onSelectTab={setActiveFileId}
              onCloseTab={handleCloseTab}
            />
            <div className="flex-1">
              {activeFile && !activeFile.isDirectory ? (
                <CodeEditor
                  key={activeFile.id}
                  fileId={activeFile.id}
                  fileName={activeFile.name}
                  content={activeFile.content ?? ""}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FileIcon className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Select a file to edit</p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20} collapsible>
          <PreviewPanel projectId={projectId} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <DeployDialog open={deployOpen} onOpenChange={setDeployOpen} projectId={projectId} />

      <AiGeneratePanel open={generateOpen} onOpenChange={setGenerateOpen} projectId={projectId} />
    </div>
  );
}
