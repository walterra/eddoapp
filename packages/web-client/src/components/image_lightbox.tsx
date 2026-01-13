import { Modal, ModalBody, ModalHeader } from 'flowbite-react';
import { type FC } from 'react';

import { AttachmentImage } from './attachment_image';

/** Props for ImageLightbox component */
export interface ImageLightboxProps {
  /** Whether the lightbox is open */
  show: boolean;
  /** Todo ID containing the attachment */
  todoId: string;
  /** Attachment key to display */
  attachmentKey: string;
  /** Alt text for the image */
  alt?: string;
  /** Called when lightbox should close */
  onClose: () => void;
}

/**
 * Full-screen lightbox overlay for viewing attachment images.
 * Uses Flowbite Modal for consistent UX. Closes on backdrop click or Escape key.
 *
 * @example
 * const [selectedImage, setSelectedImage] = useState<string | null>(null);
 *
 * <ImageLightbox
 *   show={!!selectedImage}
 *   todoId={todo._id}
 *   attachmentKey={selectedImage ?? ''}
 *   onClose={() => setSelectedImage(null)}
 * />
 */
export const ImageLightbox: FC<ImageLightboxProps> = ({
  show,
  todoId,
  attachmentKey,
  alt = 'Full size image',
  onClose,
}) => {
  const filename = attachmentKey.split('/').pop() ?? 'image';

  return (
    <Modal dismissible onClose={onClose} show={show} size="7xl">
      <ModalHeader>{filename}</ModalHeader>
      <ModalBody>
        <div className="flex items-center justify-center">
          {show && attachmentKey && (
            <AttachmentImage
              alt={alt}
              attachmentKey={attachmentKey}
              className="max-h-[70vh] max-w-full object-contain"
              todoId={todoId}
            />
          )}
        </div>
      </ModalBody>
    </Modal>
  );
};
