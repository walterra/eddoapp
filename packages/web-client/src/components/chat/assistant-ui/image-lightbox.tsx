/**
 * Lightbox component for viewing chat images in full size.
 * Uses a portal to render outside the chat context.
 */
import { type FC, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Props for ChatImageLightbox component */
export interface ChatImageLightboxProps {
  /** Whether the lightbox is visible */
  show: boolean;
  /** Callback to close the lightbox */
  onClose: () => void;
  /** Image source URL (data URL or http URL) */
  src: string;
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

/**
 * Full-screen lightbox for viewing chat images.
 * Renders via portal to escape chat layout stacking context.
 */
export const ChatImageLightbox: FC<ChatImageLightboxProps> = ({ show, onClose, src }) => {
  // Handle escape key to close
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show || !src) return null;

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
        <img
          alt="Full size preview"
          className="max-h-[90vh] max-w-[90vw] object-contain"
          src={src}
        />
      </div>
    </div>
  );

  return createPortal(lightboxContent, document.body);
};
