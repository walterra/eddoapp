/**
 * Component for displaying attachment images from the attachments database.
 */
import { useEffect, useState, type FC } from 'react';

import { usePouchDb } from '../pouch_db';

/** Props for AttachmentImage component */
export interface AttachmentImageProps {
  /** Attachment document ID (format: todoId/desc/filename or todoId/note/noteId/filename) */
  docId: string;
  /** Alt text for the image */
  alt?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for lightbox */
  onClick?: () => void;
}

/** Loading state indicator */
const LoadingPlaceholder: FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 ${className}`}
  >
    <svg
      className="h-8 w-8 animate-pulse text-neutral-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  </div>
);

/** Error state indicator */
const ErrorPlaceholder: FC<{ error: string; className?: string }> = ({ error, className = '' }) => (
  <div
    className={`flex flex-col items-center justify-center bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 ${className}`}
  >
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
    <span className="mt-1 text-xs">{error}</span>
  </div>
);

/** Hook to load attachment blob and create object URL */
function useAttachmentImage(docId: string) {
  const { attachmentsDb } = usePouchDb();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      if (!docId) {
        setError('No attachment ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const blob = await attachmentsDb.getAttachment(docId, 'file');
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob as Blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('[AttachmentImage] Failed to load:', docId, err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentsDb, docId]);

  return { imageUrl, error, isLoading };
}

/**
 * Displays an image attachment from the attachments database.
 * Fetches the blob lazily and creates an object URL for display.
 */
export const AttachmentImage: FC<AttachmentImageProps> = ({
  docId,
  alt = 'Attachment',
  className = '',
  onClick,
}) => {
  const { imageUrl, error, isLoading } = useAttachmentImage(docId);

  const containerClass = `rounded overflow-hidden ${className}`;

  if (isLoading) return <LoadingPlaceholder className={containerClass} />;
  if (error) return <ErrorPlaceholder className={containerClass} error={error} />;
  if (!imageUrl) return <ErrorPlaceholder className={containerClass} error="No image" />;

  return (
    <img
      alt={alt}
      className={`${containerClass} ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
      onClick={onClick}
      src={imageUrl}
    />
  );
};

/**
 * Hook to get an object URL for an attachment.
 * Useful when you need the URL outside of the component.
 */
export function useAttachmentUrl(docId: string): {
  url: string | null;
  isLoading: boolean;
  error: string | null;
} {
  const { attachmentsDb } = usePouchDb();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      if (!docId) {
        setError('No attachment ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const blob = await attachmentsDb.getAttachment(docId, 'file');
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob as Blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentsDb, docId]);

  return { url, isLoading, error };
}
