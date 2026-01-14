/**
 * Context for managing chat image lightbox state.
 * Allows any image in the chat to trigger the lightbox.
 */
import { createContext, useContext, useState, type FC, type ReactNode } from 'react';

import { ChatImageLightbox } from './image-lightbox';

interface ImageLightboxContextValue {
  /** Open the lightbox with the given image source */
  openLightbox: (src: string) => void;
}

const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(null);

/** Hook to access the image lightbox context */
export function useImageLightbox(): ImageLightboxContextValue {
  const context = useContext(ImageLightboxContext);
  if (!context) {
    throw new Error('useImageLightbox must be used within ImageLightboxProvider');
  }
  return context;
}

/** Props for ImageLightboxProvider */
interface ImageLightboxProviderProps {
  children: ReactNode;
}

/** Provider component that manages lightbox state and renders the lightbox */
export const ImageLightboxProvider: FC<ImageLightboxProviderProps> = ({ children }) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = (src: string) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);

  return (
    <ImageLightboxContext.Provider value={{ openLightbox }}>
      {children}
      <ChatImageLightbox onClose={closeLightbox} show={!!lightboxSrc} src={lightboxSrc ?? ''} />
    </ImageLightboxContext.Provider>
  );
};
