"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import {
  CloudIcon,
  HardDriveIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import { useRef } from "react";
import type { Attachment, AttachmentSource, FileUploadConfig } from "./types";
import { defaultFileUploadConfig } from "./types";

type FileUploadButtonProps = {
  onFilesSelected: (files: File[], source: AttachmentSource) => void;
  config?: FileUploadConfig;
  disabled?: boolean;
  className?: string;
};

export function FileUploadButton({
  onFilesSelected,
  config = defaultFileUploadConfig,
  disabled = false,
  className,
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files, "local");
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCloudUpload = (source: AttachmentSource) => {
    // TODO: Implement cloud storage picker (OneDrive, Google Drive, Dropbox)
    console.log(`Opening ${source} picker...`);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={config.allowedTypes.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                className={cn(
                  "h-8 w-8 rounded-full border-border/60 hover:bg-accent shrink-0",
                  className
                )}
              >
                <PlusIcon className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Add files</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={handleLocalFileSelect}
            className="gap-2 cursor-pointer"
          >
            <UploadIcon className="h-4 w-4" />
            <span>Upload from computer</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleCloudUpload("google-drive")}
            className="gap-2 cursor-pointer"
          >
            <CloudIcon className="h-4 w-4" />
            <span>Google Drive</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleCloudUpload("onedrive")}
            className="gap-2 cursor-pointer"
          >
            <HardDriveIcon className="h-4 w-4" />
            <span>OneDrive</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleCloudUpload("dropbox")}
            className="gap-2 cursor-pointer"
          >
            <CloudIcon className="h-4 w-4" />
            <span>Dropbox</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
