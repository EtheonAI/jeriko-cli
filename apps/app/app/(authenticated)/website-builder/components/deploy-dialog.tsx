"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Label } from "@repo/design-system/components/ui/label";
import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  building: "default",
  deploying: "default",
  deployed: "outline",
  failed: "destructive",
};

export function DeployDialog({ open, onOpenChange, projectId }: DeployDialogProps) {
  const [platform, setPlatform] = useState<"vercel" | "netlify">("vercel");
  const [environment, setEnvironment] = useState("preview");

  const { data: recentDeployments } = trpc.websiteBuilder.deployList.useQuery(
    { projectId },
    { enabled: open }
  );

  const utils = trpc.useUtils();
  const createDeploy = trpc.websiteBuilder.deployCreate.useMutation({
    onSuccess: () => {
      utils.websiteBuilder.deployList.invalidate({ projectId });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deploy Project</DialogTitle>
          <DialogDescription>Deploy your project to a hosting platform.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as "vercel" | "netlify")}>
              <SelectTrigger id="platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="netlify">Netlify</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="environment">Environment</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger id="environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recentDeployments && recentDeployments.length > 0 && (
            <div className="grid gap-2">
              <Label>Recent Deployments</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {recentDeployments.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariants[dep.status] ?? "secondary"}>
                        {dep.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {dep.platform} / {dep.environment}
                      </span>
                    </div>
                    {dep.url && (
                      <a
                        href={dep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createDeploy.mutate({ projectId, platform, environment })}
            disabled={createDeploy.isPending}
          >
            {createDeploy.isPending ? "Deploying..." : "Deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
