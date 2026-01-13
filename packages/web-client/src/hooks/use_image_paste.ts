import { useCallback, useEffect } from 'react';

import { isAllowedContentType, MAX_ATTACHMENT_SIZE } from '@eddo/core-shared';

/** Configuration for image paste handler */
export interface UseImagePasteOptions {
  /** Called when a valid image is pasted */
  onImagePaste: (file: File) => void;
  /** Called when paste validation fails */
  onError?: (error: string) => void;
  /** Whether the handler is enabled */
  enabled?: boolean;
}

/** Generates a filename for clipboard images */
function generatePasteFilename(mimeType: string): string {
  const ext = mimeType.split('/')[1] ?? 'png';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pasted-${timestamp}.${ext}`;
}

/** Extracts and validates an image file from clipboard item */
function extractImageFromClipboard(item: DataTransferItem): File | null {
  if (item.kind !== 'file') return null;
  if (!isAllowedContentType(item.type)) return null;

  const file = item.getAsFile();
  if (!file) return null;

  const filename = file.name || generatePasteFilename(item.type);
  return new File([file], filename, { type: file.type });
}

/**
 * Hook for handling image paste from clipboard.
 * Intercepts paste events and extracts image data.
 *
 * @example
 * useImagePaste({
 *   onImagePaste: (file) => uploadImage(file),
 *   onError: (msg) => showError(msg),
 * });
 */
export function useImagePaste({
  onImagePaste,
  onError,
  enabled = true,
}: UseImagePasteOptions): void {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        const file = extractImageFromClipboard(item);
        if (!file) continue;

        if (file.size > MAX_ATTACHMENT_SIZE) {
          onError?.(`Image exceeds ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB limit`);
          return;
        }

        e.preventDefault();
        onImagePaste(file);
        return;
      }
    },
    [onImagePaste, onError],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enabled, handlePaste]);
}
