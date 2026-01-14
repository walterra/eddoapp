/**
 * Attachment document stored in the separate attachments database.
 * Each attachment is a standalone document with the blob stored as a PouchDB attachment.
 * Note: _attachments is managed by PouchDB and not included in this type.
 */
export interface AttachmentDoc {
  /** Document ID format: {todoId}/{type}/{filename} or {todoId}/{type}/{noteId}/{filename} */
  _id: string;
  /** PouchDB revision */
  _rev?: string;
  /** Parent todo ID */
  todoId: string;
  /** Attachment type: 'desc' for description, 'note' for note */
  type: 'desc' | 'note';
  /** Note ID (only for type='note') */
  noteId?: string;
  /** Original filename */
  filename: string;
  /** MIME content type */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** ISO timestamp when attachment was created */
  createdAt: string;
}

/**
 * Builds the attachment document ID.
 * Format: {todoId}/desc/{filename} or {todoId}/note/{noteId}/{filename}
 */
export function buildAttachmentDocId(
  todoId: string,
  type: 'desc' | 'note',
  filename: string,
  noteId?: string,
): string {
  if (type === 'note') {
    if (!noteId) throw new Error('noteId required for note attachments');
    return `${todoId}/note/${noteId}/${filename}`;
  }
  return `${todoId}/desc/${filename}`;
}

/**
 * Parses an attachment document ID into its components.
 */
export function parseAttachmentDocId(docId: string): {
  todoId: string;
  type: 'desc' | 'note';
  filename: string;
  noteId?: string;
} | null {
  const parts = docId.split('/');

  if (parts.length === 3 && parts[1] === 'desc') {
    return { todoId: parts[0], type: 'desc', filename: parts[2] };
  }

  if (parts.length === 4 && parts[1] === 'note') {
    return { todoId: parts[0], type: 'note', noteId: parts[2], filename: parts[3] };
  }

  return null;
}
