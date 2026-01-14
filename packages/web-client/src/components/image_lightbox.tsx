/**
 * Lightbox component for viewing attachment images in full size.
 * Uses a portal to render outside the flyout/drawer context.
 */
import { type FC } from 'react';
import { createPortal } from 'react-dom';

import { useAttachmentUrl } from './attachment_image';

/** Props for ImageLightbox component */
export interface ImageLightboxProps {
  /** Whether the lightbox is visible */
  show: boolean;
  /** Callback to close the lightbox */
  onClose: () => void;
  /** Attachment document ID */
  docId: string;
}

/** Close button for lightbox */
const CloseButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
    onClick={onClick}
    type="button"
  >
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  </button>
);

/** Loading state for lightbox */
const LoadingState: FC = () => (
  <div className="flex h-64 w-64 items-center justify-center">
    <svg
      className="h-12 w-12 animate-pulse text-white/50"
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

/** Error state for lightbox */
const ErrorState: FC<{ error: string }> = ({ error }) => (
  <div className="flex h-64 flex-col items-center justify-center text-white">
    <span>Failed to load image</span>
    <span className="mt-1 text-sm text-white/60">{error}</span>
  </div>
);

/**
 * Full-screen lightbox for viewing attachment images.
 * Renders via portal to escape flyout/drawer stacking context.
 */
export const ImageLightbox: FC<ImageLightboxProps> = ({ show, onClose, docId }) => {
  // Only fetch if we have a valid docId
  const { url, isLoading, error } = useAttachmentUrl(show && docId ? docId : '');

  // Don't render if not shown or no docId
  if (!show || !docId) return null;

  const lightboxContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <CloseButton onClick={onClose} />
      <div
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}
        {url && (
          <img
            alt="Full size preview"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            src={url}
          />
        )}
      </div>
    </div>
  );

  return createPortal(lightboxContent, document.body);
};
