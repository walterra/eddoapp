/**
 * Note attachments display and upload component
 */
import { type FC, useCallback, useState } from 'react';
import { BiImage } from 'react-icons/bi';

import { useAttachment } from '../hooks/use_attachment';
import { AttachmentImage } from './attachment_image';
import { FileDropZone } from './file_drop_zone';

interface NoteAttachmentsDisplayProps {
  todoId: string;
  noteId: string;
  attachments?: string[];
}

/** Displays existing note attachments as thumbnails */
const NoteAttachmentsDisplay: FC<NoteAttachmentsDisplayProps> = ({
  todoId,
  noteId,
  attachments,
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((filename) => (
        <AttachmentImage
          alt={filename}
          className="h-20 w-20 object-cover"
          docId={`${todoId}/note/${noteId}/${filename}`}
          key={filename}
        />
      ))}
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
  const { uploadAttachment, isUploading } = useAttachment();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      setUploadError(null);
      const newAttachments: string[] = [];

      for (const file of files) {
        try {
          const result = await uploadAttachment.mutateAsync({
            todoId,
            file,
            type: 'note',
            noteId,
          });
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

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-600">
      <NoteAttachmentsDisplay attachments={attachments} noteId={noteId} todoId={todoId} />
      <NoteAttachmentsUpload
        isUploading={isUploading}
        onFilesDropped={handleFilesDropped}
        uploadError={uploadError}
      />
    </div>
  );
};
