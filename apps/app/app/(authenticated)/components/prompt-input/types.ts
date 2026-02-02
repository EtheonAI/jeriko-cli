export type AttachmentType = "file" | "image" | "document" | "audio" | "video";

export type AttachmentSource = "local" | "onedrive" | "google-drive" | "dropbox";

export type Attachment = {
  id: string;
  name: string;
  type: AttachmentType;
  source: AttachmentSource;
  url?: string;
  file?: File;
  size: number;
  mimeType: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
};

export type ConnectedApp = {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  type: "email" | "calendar" | "storage" | "browser" | "custom";
};

export type VoiceState = "idle" | "listening" | "processing" | "error";

export type PromptInputProps = {
  onSubmit: (data: PromptSubmitData) => void;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  showToolbar?: boolean;
  showConnections?: boolean;
  showVoice?: boolean;
  showFileUpload?: boolean;
  connectedApps?: ConnectedApp[];
  className?: string;
};

export type PromptSubmitData = {
  text: string;
  attachments: Attachment[];
  selectedApps: string[];
  voiceTranscript?: string;
};

export type FileUploadConfig = {
  maxSize: number; // in bytes
  allowedTypes: string[];
  maxFiles: number;
};

export const defaultFileUploadConfig: FileUploadConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: [
    "image/*",
    "application/pdf",
    "text/*",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "audio/*",
    "video/*",
  ],
  maxFiles: 10,
};
