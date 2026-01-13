/**
 * Description field component for todo editing with attachment support
 */
import type { Todo } from '@eddo/core-client';
import { Button, Label, Textarea } from 'flowbite-react';
import { type FC, useState } from 'react';

import { AttachmentMarkdown, MARKDOWN_PROSE_CLASSES } from './attachment_markdown';
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

/** Edit mode textarea */
const DescriptionTextarea: FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <Textarea
    aria-label="Description"
    id="eddoTodoDescription"
    onChange={(e) => onChange(e.target.value)}
    placeholder="Add a description... (supports Markdown, images: ![](attachment:desc/file.png))"
    rows={6}
    value={value}
  />
);

/**
 * Description field with edit/preview toggle and attachment support.
 * In preview mode, renders markdown with attachment images.
 */
export const DescriptionField: FC<DescriptionFieldProps> = ({ todo, onChange }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const hasContent = todo.description.trim().length > 0;

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
        <DescriptionTextarea
          onChange={(value) => onChange((t) => ({ ...t, description: value }))}
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
