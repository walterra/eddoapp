/**
 * Note attachments display and upload component
 */
import { type FC, useCallback, useState } from 'react';
import { BiImage } from 'react-icons/bi';

import { useAttachment } from '../hooks/use_attachment';
import { AttachmentImage } from './attachment_image';
import { FileDropZone } from './file_drop_zone';
import { ImageLightbox } from './image_lightbox';

interface NoteAttachmentsDisplayProps {
  todoId: string;
  noteId: string;
  attachments?: string[];
  onImageClick: (docId: string) => void;
}

/** Displays existing note attachments as thumbnails */
const NoteAttachmentsDisplay: FC<NoteAttachmentsDisplayProps> = ({
  todoId,
  noteId,
  attachments,
  onImageClick,
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((filename) => {
        const docId = `${todoId}/note/${noteId}/${filename}`;
        return (
          <AttachmentImage
            alt={filename}
            className="h-20 w-20 cursor-pointer object-cover hover:opacity-80"
            docId={docId}
            key={filename}
            onClick={() => onImageClick(docId)}
          />
        );
      })}
    </div>
  );
};

interface NoteAttachmentsUploadProps {
  isUploading: boolean;
  onFilesDropped: (files: File[]) => void;
  uploadError: string | null;
}

/** Upload zone for note attachments */
const NoteAttachmentsUpload: FC<NoteAttachmentsUploadProps> = ({
  isUploading,
  onFilesDropped,
  uploadError,
}) => (
  <>
    <FileDropZone
      className="!p-2"
      isUploading={isUploading}
      multiple
      onFilesDropped={onFilesDropped}
    >
      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <BiImage size="1.2em" />
        <span>Drop images to attach</span>
      </div>
    </FileDropZone>
    {uploadError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
  </>
);

export interface NoteAttachmentsProps {
  todoId: string;
  noteId: string;
  attachments?: string[];
  onAttachmentsChange: (attachments: string[]) => void;
}

/** Hook for handling file uploads to note attachments */
function useNoteAttachmentUpload(
  todoId: string,
  noteId: string,
  attachments: string[] | undefined,
  onAttachmentsChange: (attachments: string[]) => void,
) {
  const { uploadAttachment, isUploading } = useAttachment();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      setUploadError(null);
      const newAttachments: string[] = [];

      for (const file of files) {
        try {
          const result = await uploadAttachment.mutateAsync({ todoId, file, type: 'note', noteId });
          newAttachments.push(result.filename);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed');
          break;
        }
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...(attachments ?? []), ...newAttachments]);
      }
    },
    [todoId, noteId, attachments, uploadAttachment, onAttachmentsChange],
  );

  return { handleFilesDropped, isUploading, uploadError };
}

/**
 * Combined component for displaying and uploading note attachments.
 * Handles upload logic internally and reports changes via callback.
 */
export const NoteAttachments: FC<NoteAttachmentsProps> = ({
  todoId,
  noteId,
  attachments,
  onAttachmentsChange,
}) => {
  const { handleFilesDropped, isUploading, uploadError } = useNoteAttachmentUpload(
    todoId,
    noteId,
    attachments,
    onAttachmentsChange,
  );
  const [lightboxDocId, setLightboxDocId] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-600">
      <NoteAttachmentsDisplay
        attachments={attachments}
        noteId={noteId}
        onImageClick={setLightboxDocId}
        todoId={todoId}
      />
      <NoteAttachmentsUpload
        isUploading={isUploading}
        onFilesDropped={handleFilesDropped}
        uploadError={uploadError}
      />
      <ImageLightbox
        docId={lightboxDocId ?? ''}
        onClose={() => setLightboxDocId(null)}
        show={!!lightboxDocId}
      />
    </div>
  );
};
