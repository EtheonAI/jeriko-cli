import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  ArchiveIcon,
  CodeIcon,
  TableIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
  FolderIcon,
  FileJsonIcon,
  type LucideIcon,
} from "lucide-react";
import type { FileTab } from "@/lib/store/slices/fileManagement.slice";

const MIME_ICON_MAP: Record<string, LucideIcon> = {
  "application/folder": FolderIcon,
  "application/pdf": FileTextIcon,
  "application/json": FileJsonIcon,
  "application/xml": CodeIcon,
  "application/zip": ArchiveIcon,
  "application/x-rar-compressed": ArchiveIcon,
  "application/x-7z-compressed": ArchiveIcon,
  "application/gzip": ArchiveIcon,
  "application/x-tar": ArchiveIcon,
  "application/vnd.ms-excel": FileSpreadsheetIcon,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheetIcon,
  "application/vnd.ms-powerpoint": PresentationIcon,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": PresentationIcon,
  "application/msword": FileTextIcon,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileTextIcon,
  "text/csv": TableIcon,
  "text/html": CodeIcon,
  "text/css": CodeIcon,
  "text/javascript": CodeIcon,
  "application/javascript": CodeIcon,
  "application/typescript": CodeIcon,
};

export function getFileIcon(mimeType: string | null | undefined): LucideIcon {
  if (!mimeType) return FileIcon;
  if (MIME_ICON_MAP[mimeType]) return MIME_ICON_MAP[mimeType];
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return VideoIcon;
  if (mimeType.startsWith("audio/")) return MusicIcon;
  if (mimeType.startsWith("text/")) return FileTextIcon;
  return FileIcon;
}

export function getMimeCategory(mimeType: string | null | undefined): FileTab {
  if (!mimeType) return "other";
  if (mimeType === "application/folder") return "other";
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("video/")) return "videos";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("spreadsheetml") ||
    mimeType.includes("presentationml") ||
    mimeType === "application/json"
  ) {
    return "documents";
  }
  return "other";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[i]}`;
}

export function isPreviewable(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  if (mimeType.startsWith("image/")) return true;
  if (mimeType.startsWith("video/")) return true;
  if (mimeType.startsWith("audio/")) return true;
  if (mimeType === "application/pdf") return true;
  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "application/json") return true;
  if (mimeType === "application/javascript") return true;
  return false;
}

export function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : "";
}
