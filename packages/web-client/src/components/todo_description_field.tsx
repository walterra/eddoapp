/**
 * Description field component for todo editing with attachment upload support
 */
import type { Todo } from '@eddo/core-client';
import { Button, Label, Textarea } from 'flowbite-react';
import { type FC, useCallback, useState } from 'react';

import { useAttachment } from '../hooks/use_attachment';
import { useImagePaste } from '../hooks/use_image_paste';
import { AttachmentMarkdown, MARKDOWN_PROSE_CLASSES } from './attachment_markdown';
import { FileDropZone } from './file_drop_zone';
import { ImageLightbox } from './image_lightbox';

interface DescriptionFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

/** Preview toggle buttons */
const PreviewToggle: FC<{
  isPreview: boolean;
  onToggle: (preview: boolean) => void;
}> = ({ isPreview, onToggle }) => (
  <div className="flex gap-1">
    <Button color={isPreview ? 'gray' : 'blue'} onClick={() => onToggle(false)} size="xs">
      Edit
    </Button>
    <Button color={isPreview ? 'blue' : 'gray'} onClick={() => onToggle(true)} size="xs">
      Preview
    </Button>
  </div>
);

/** Preview mode content */
const DescriptionPreview: FC<{
  todoId: string;
  description: string;
  onImageClick: (key: string) => void;
}> = ({ todoId, description, onImageClick }) => (
  <div
    aria-label="Description preview"
    className={`${MARKDOWN_PROSE_CLASSES} rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-700`}
  >
    <AttachmentMarkdown onImageClick={onImageClick} todoId={todoId}>
      {description}
    </AttachmentMarkdown>
  </div>
);

interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  isUploading: boolean;
  onFilesDropped: (files: File[]) => void;
  uploadError: string | null;
}

/** Edit mode with textarea and upload zone */
const DescriptionEditor: FC<DescriptionEditorProps> = ({
  value,
  onChange,
  isUploading,
  onFilesDropped,
  uploadError,
}) => (
  <div className="space-y-3">
    <Textarea
      aria-label="Description"
      id="eddoTodoDescription"
      onChange={(e) => onChange(e.target.value)}
      placeholder="Add a description... (supports Markdown)"
      rows={6}
      value={value}
    />

    <FileDropZone
      className="mt-2"
      isUploading={isUploading}
      multiple
      onFilesDropped={onFilesDropped}
      onValidationError={(errors) => console.warn('Upload validation errors:', errors)}
    >
      <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        <p>Drop images here to attach, or paste from clipboard</p>
        <p className="mt-1 text-xs">Auto-compressed • Max 5MB</p>
      </div>
    </FileDropZone>

    {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
  </div>
);

/** Hook for managing description field upload logic */
function useDescriptionUpload(todo: Todo, onChange: DescriptionFieldProps['onChange']) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { uploadAttachment, isUploading } = useAttachment();

  const insertMarkdownRef = useCallback(
    (markdownRef: string) => {
      onChange((t) => ({
        ...t,
        description: t.description + (t.description ? '\n\n' : '') + markdownRef,
      }));
    },
    [onChange],
  );

  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      setUploadError(null);
      for (const file of files) {
        try {
          const result = await uploadAttachment.mutateAsync({
            todoId: todo._id,
            file,
            type: 'desc',
          });
          insertMarkdownRef(`![${result.filename}](attachment:${result.key})`);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed');
          break;
        }
      }
    },
    [todo._id, uploadAttachment, insertMarkdownRef],
  );

  return { handleFilesDropped, isUploading, uploadError, setUploadError };
}

/**
 * Description field with edit/preview toggle, attachment upload, and paste support.
 */
export const DescriptionField: FC<DescriptionFieldProps> = ({ todo, onChange }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const hasContent = todo.description.trim().length > 0;

  const { handleFilesDropped, isUploading, uploadError, setUploadError } = useDescriptionUpload(
    todo,
    onChange,
  );

  useImagePaste({
    onImagePaste: (file) => handleFilesDropped([file]),
    onError: setUploadError,
    enabled: !isPreview,
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor="eddoTodoDescription">Description</Label>
        {hasContent && <PreviewToggle isPreview={isPreview} onToggle={setIsPreview} />}
      </div>

      {isPreview ? (
        <DescriptionPreview
          description={todo.description}
          onImageClick={setLightboxImage}
          todoId={todo._id}
        />
      ) : (
        <DescriptionEditor
          isUploading={isUploading}
          onChange={(value) => onChange((t) => ({ ...t, description: value }))}
          onFilesDropped={handleFilesDropped}
          uploadError={uploadError}
          value={todo.description}
        />
      )}

      <ImageLightbox
        attachmentKey={lightboxImage ?? ''}
        onClose={() => setLightboxImage(null)}
        show={!!lightboxImage}
        todoId={todo._id}
      />
    </div>
  );
};
