"use client";

import { useState } from "react";
import { ProjectList } from "./components/project-list";
import { BuilderLayout } from "./components/builder-layout";

export function WebsiteBuilderClient() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (!selectedProjectId) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <ProjectList onSelectProject={setSelectedProjectId} />
      </div>
    );
  }

  return <BuilderLayout projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />;
}
