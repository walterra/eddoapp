/**
 * Read-only view component for a single note with attachments
 */
import type { TodoNote } from '@eddo/core-client';
import { type FC, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AttachmentImage } from './attachment_image';
import { MARKDOWN_PROSE_CLASSES } from './attachment_markdown';
import { ImageLightbox } from './image_lightbox';

/** Formats a date for display */
function formatNoteDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface NoteViewItemProps {
  todoId: string;
  note: TodoNote;
}

export const NoteViewItem: FC<NoteViewItemProps> = ({ todoId, note }) => {
  const [lightboxDocId, setLightboxDocId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatNoteDate(note.createdAt)}
        </span>
        {note.updatedAt && (
          <span className="text-xs text-neutral-400 italic dark:text-neutral-500">
            edited {formatNoteDate(note.updatedAt)}
          </span>
        )}
      </div>
      <div className={MARKDOWN_PROSE_CLASSES}>
        <Markdown remarkPlugins={[remarkGfm]}>{note.content}</Markdown>
      </div>
      {note.attachments && note.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-600">
          {note.attachments.map((filename) => {
            const docId = `${todoId}/note/${note.id}/${filename}`;
            return (
              <AttachmentImage
                alt={filename}
                className="h-20 w-20 cursor-pointer object-cover hover:opacity-80"
                docId={docId}
                key={filename}
                onClick={() => setLightboxDocId(docId)}
              />
            );
          })}
        </div>
      )}
      <ImageLightbox
        docId={lightboxDocId ?? ''}
        onClose={() => setLightboxDocId(null)}
        show={!!lightboxDocId}
      />
    </div>
  );
};
