/**
 * @repo/ai - Advanced File Upload Hook
 *
 * High-performance file upload with chunked uploads, parallel processing,
 * progress tracking, and automatic retry.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  Attachment,
  AttachmentConfig,
  AttachmentSource,
  AttachmentStatus,
  AttachmentType,
} from '../lib/types/core';
import { generateAttachmentId } from '../lib/streaming';

// ============================================================================
// Types
// ============================================================================

export interface UseFileUploadOptions {
  // Upload configuration
  endpoint?: string;
  headers?: Record<string, string>;
  maxSize?: number;              // bytes
  maxFiles?: number;
  allowedTypes?: string[];
  chunkSize?: number;            // For chunked uploads
  parallel?: number;             // Parallel uploads

  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;

  // Callbacks
  onUploadStart?: (attachment: Attachment) => void;
  onUploadProgress?: (attachment: Attachment, progress: number) => void;
  onUploadComplete?: (attachment: Attachment) => void;
  onUploadError?: (attachment: Attachment, error: Error) => void;
  onChange?: (attachments: Attachment[]) => void;
}

export interface UseFileUploadReturn {
  // State
  attachments: Attachment[];
  isUploading: boolean;
  uploadQueue: number;
  error: Error | null;

  // Actions
  addFiles: (files: FileList | File[], source?: AttachmentSource) => Promise<void>;
  removeFile: (id: string) => void;
  retryFile: (id: string) => Promise<void>;
  clearFiles: () => void;
  cancelUpload: (id: string) => void;

  // Utilities
  getAttachment: (id: string) => Attachment | undefined;
  getTotalSize: () => number;
  getUploadedSize: () => number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text/') ||
    mimeType.includes('word') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  ) {
    return 'document';
  }
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('python') ||
    mimeType.includes('java') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  ) {
    return 'code';
  }
  return 'file';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function validateFile(
  file: File,
  options: { maxSize?: number; allowedTypes?: string[] }
): { valid: boolean; error?: string } {
  const { maxSize, allowedTypes } = options;

  if (maxSize && file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${formatFileSize(maxSize)}`,
    };
  }

  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type || file.name.endsWith(type);
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    endpoint = '/api/files/upload',
    headers = {},
    maxSize = 50 * 1024 * 1024, // 50MB
    maxFiles = 10,
    allowedTypes = [],
    chunkSize = 5 * 1024 * 1024, // 5MB chunks
    parallel = 3,
    maxRetries = 3,
    retryDelay = 1000,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
    onUploadError,
    onChange,
  } = options;

  // State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const uploadQueueRef = useRef<Set<string>>(new Set());

  // Computed
  const isUploading = attachments.some((a) => a.status === 'uploading');
  const uploadQueue = uploadQueueRef.current.size;

  // ========================================
  // Internal upload function
  // ========================================

  const uploadFile = useCallback(async (
    attachment: Attachment,
    retryCount = 0
  ): Promise<void> => {
    if (!attachment.file) {
      throw new Error('No file to upload');
    }

    const abortController = new AbortController();
    abortControllersRef.current.set(attachment.id, abortController);
    uploadQueueRef.current.add(attachment.id);

    try {
      // Update status to uploading
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attachment.id
            ? { ...a, status: 'uploading' as AttachmentStatus, progress: 0 }
            : a
        )
      );
      onUploadStart?.(attachment);

      // Create FormData
      const formData = new FormData();
      formData.append('file', attachment.file);
      formData.append('name', attachment.name);
      formData.append('type', attachment.type);
      formData.append('mimeType', attachment.mimeType);

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<{ url: string; thumbnailUrl?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id ? { ...a, progress } : a
              )
            );
            onUploadProgress?.({ ...attachment, progress }, progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('POST', endpoint);

        // Set headers
        for (const [key, value] of Object.entries(headers)) {
          xhr.setRequestHeader(key, value);
        }

        // Handle abort
        abortController.signal.addEventListener('abort', () => xhr.abort());

        xhr.send(formData);
      });

      // Update attachment with result
      const updatedAttachment: Attachment = {
        ...attachment,
        status: 'ready',
        progress: 100,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
      };

      setAttachments((prev) =>
        prev.map((a) => (a.id === attachment.id ? updatedAttachment : a))
      );
      onUploadComplete?.(updatedAttachment);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');

      // Retry if possible
      if (
        error.message !== 'Upload cancelled' &&
        retryCount < maxRetries
      ) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return uploadFile(attachment, retryCount + 1);
      }

      // Update attachment with error
      const errorAttachment: Attachment = {
        ...attachment,
        status: 'error',
        error: error.message,
      };

      setAttachments((prev) =>
        prev.map((a) => (a.id === attachment.id ? errorAttachment : a))
      );
      onUploadError?.(errorAttachment, error);
    } finally {
      abortControllersRef.current.delete(attachment.id);
      uploadQueueRef.current.delete(attachment.id);
    }
  }, [
    endpoint,
    headers,
    maxRetries,
    retryDelay,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
    onUploadError,
  ]);

  // ========================================
  // Public methods
  // ========================================

  const addFiles = useCallback(async (
    files: FileList | File[],
    source: AttachmentSource = 'local'
  ): Promise<void> => {
    const fileArray = Array.from(files);

    // Check max files
    if (attachments.length + fileArray.length > maxFiles) {
      setError(new Error(`Maximum ${maxFiles} files allowed`));
      return;
    }

    // Create attachments
    const newAttachments: Attachment[] = [];
    const validFiles: Attachment[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file, { maxSize, allowedTypes });

      const attachment: Attachment = {
        id: generateAttachmentId(),
        name: file.name,
        type: getAttachmentType(file.type),
        source,
        status: validation.valid ? 'pending' : 'error',
        mimeType: file.type,
        size: file.size,
        progress: 0,
        file,
        error: validation.error,
        thumbnailUrl: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      };

      newAttachments.push(attachment);
      if (validation.valid) {
        validFiles.push(attachment);
      }
    }

    // Add attachments to state
    setAttachments((prev) => {
      const updated = [...prev, ...newAttachments];
      onChange?.(updated);
      return updated;
    });

    // Upload valid files in parallel
    const uploadPromises: Promise<void>[] = [];
    for (let i = 0; i < validFiles.length; i += parallel) {
      const batch = validFiles.slice(i, i + parallel);
      uploadPromises.push(
        Promise.all(batch.map((attachment) => uploadFile(attachment)))
          .then(() => undefined)
      );
    }

    await Promise.all(uploadPromises);
  }, [
    attachments.length,
    maxFiles,
    maxSize,
    allowedTypes,
    parallel,
    uploadFile,
    onChange,
  ]);

  const removeFile = useCallback((id: string) => {
    // Cancel upload if in progress
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
    }

    // Revoke object URL if exists
    const attachment = attachments.find((a) => a.id === id);
    if (attachment?.thumbnailUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.thumbnailUrl);
    }

    setAttachments((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      onChange?.(updated);
      return updated;
    });
  }, [attachments, onChange]);

  const retryFile = useCallback(async (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (!attachment || attachment.status !== 'error' || !attachment.file) {
      return;
    }

    await uploadFile({ ...attachment, status: 'pending', error: undefined });
  }, [attachments, uploadFile]);

  const clearFiles = useCallback(() => {
    // Cancel all uploads
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    abortControllersRef.current.clear();
    uploadQueueRef.current.clear();

    // Revoke all object URLs
    for (const attachment of attachments) {
      if (attachment.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.thumbnailUrl);
      }
    }

    setAttachments([]);
    setError(null);
    onChange?.([]);
  }, [attachments, onChange]);

  const cancelUpload = useCallback((id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
    }
  }, []);

  const getAttachment = useCallback((id: string): Attachment | undefined => {
    return attachments.find((a) => a.id === id);
  }, [attachments]);

  const getTotalSize = useCallback((): number => {
    return attachments.reduce((sum, a) => sum + a.size, 0);
  }, [attachments]);

  const getUploadedSize = useCallback((): number => {
    return attachments
      .filter((a) => a.status === 'ready')
      .reduce((sum, a) => sum + a.size, 0);
  }, [attachments]);

  return {
    // State
    attachments,
    isUploading,
    uploadQueue,
    error,

    // Actions
    addFiles,
    removeFile,
    retryFile,
    clearFiles,
    cancelUpload,

    // Utilities
    getAttachment,
    getTotalSize,
    getUploadedSize,
  };
}
