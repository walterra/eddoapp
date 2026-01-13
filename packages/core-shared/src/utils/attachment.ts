/**
 * Attachment utilities for CouchDB/PouchDB attachment management.
 * Handles naming conventions, validation, and parsing for todo attachments.
 */

/** Maximum attachment size in bytes (5MB) */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types for attachments */
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

/** Attachment location types */
export type AttachmentType = 'desc' | 'note';

/** Parsed attachment key components */
export interface ParsedAttachmentKey {
  /** Attachment location: 'desc' for description, 'note' for note */
  type: AttachmentType;
  /** Note ID (only present for note attachments) */
  noteId?: string;
  /** Original filename */
  filename: string;
}

/** Validation result for attachments */
export interface AttachmentValidationResult {
  /** Whether the attachment is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Builds a CouchDB attachment key with proper namespace.
 *
 * @param type - 'desc' for description attachments, 'note' for note attachments
 * @param filename - Original filename
 * @param noteId - Note ID (required for note attachments)
 * @returns Namespaced attachment key
 *
 * @example
 * buildAttachmentKey('desc', 'screenshot.png')
 * // Returns: 'desc/screenshot.png'
 *
 * buildAttachmentKey('note', 'photo.jpg', 'abc-123')
 * // Returns: 'note/abc-123/photo.jpg'
 */
export function buildAttachmentKey(
  type: AttachmentType,
  filename: string,
  noteId?: string,
): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename is required');
  }

  const sanitized = sanitizeFilename(filename);

  if (type === 'desc') {
    return `desc/${sanitized}`;
  }

  if (type === 'note') {
    if (!noteId) {
      throw new Error('Note ID is required for note attachments');
    }
    return `note/${noteId}/${sanitized}`;
  }

  throw new Error(`Invalid attachment type: ${type}`);
}

/**
 * Parses a CouchDB attachment key into its components.
 *
 * @param key - Attachment key to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * parseAttachmentKey('desc/screenshot.png')
 * // Returns: { type: 'desc', filename: 'screenshot.png' }
 *
 * parseAttachmentKey('note/abc-123/photo.jpg')
 * // Returns: { type: 'note', noteId: 'abc-123', filename: 'photo.jpg' }
 */
export function parseAttachmentKey(key: string): ParsedAttachmentKey | null {
  if (!key || typeof key !== 'string') {
    return null;
  }

  const parts = key.split('/');

  if (parts[0] === 'desc' && parts.length === 2 && parts[1]) {
    return {
      type: 'desc',
      filename: parts[1],
    };
  }

  if (parts[0] === 'note' && parts.length === 3 && parts[1] && parts[2]) {
    return {
      type: 'note',
      noteId: parts[1],
      filename: parts[2],
    };
  }

  return null;
}

/**
 * Validates an attachment file for size and type restrictions.
 *
 * @param size - File size in bytes
 * @param contentType - MIME type of the file
 * @returns Validation result with error message if invalid
 *
 * @example
 * validateAttachment(1024, 'image/png')
 * // Returns: { valid: true }
 *
 * validateAttachment(10_000_000, 'image/png')
 * // Returns: { valid: false, error: 'File size exceeds 5MB limit' }
 */
export function validateAttachment(size: number, contentType: string): AttachmentValidationResult {
  if (typeof size !== 'number' || size <= 0 || Number.isNaN(size)) {
    return { valid: false, error: 'Invalid file size' };
  }

  if (size > MAX_ATTACHMENT_SIZE) {
    return { valid: false, error: 'File size exceeds 5MB limit' };
  }

  if (!contentType || typeof contentType !== 'string') {
    return { valid: false, error: 'Content type is required' };
  }

  if (!isAllowedContentType(contentType)) {
    const allowed = ALLOWED_ATTACHMENT_TYPES.join(', ');
    return { valid: false, error: `Content type not allowed. Allowed: ${allowed}` };
  }

  return { valid: true };
}

/**
 * Checks if a content type is in the allowed list.
 *
 * @param contentType - MIME type to check
 * @returns True if allowed
 */
export function isAllowedContentType(contentType: string): contentType is AllowedAttachmentType {
  return ALLOWED_ATTACHMENT_TYPES.includes(contentType as AllowedAttachmentType);
}

/**
 * Sanitizes a filename for safe storage.
 * Removes path separators, null bytes, and trims whitespace.
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * Extracts attachment keys from a todo's _attachments object.
 *
 * @param attachments - CouchDB _attachments object
 * @returns Array of attachment keys
 */
export function getAttachmentKeys(
  attachments: Record<string, unknown> | undefined,
): readonly string[] {
  if (!attachments || typeof attachments !== 'object') {
    return [];
  }
  return Object.keys(attachments);
}

/**
 * Filters attachment keys by type (desc or note).
 *
 * @param keys - Array of attachment keys
 * @param type - Type to filter by
 * @returns Filtered keys
 */
export function filterAttachmentsByType(
  keys: readonly string[],
  type: AttachmentType,
): readonly string[] {
  return keys.filter((key) => {
    const parsed = parseAttachmentKey(key);
    return parsed?.type === type;
  });
}

/**
 * Gets attachment keys for a specific note.
 *
 * @param keys - Array of attachment keys
 * @param noteId - Note ID to filter by
 * @returns Keys belonging to the note
 */
export function getAttachmentsForNote(keys: readonly string[], noteId: string): readonly string[] {
  return keys.filter((key) => {
    const parsed = parseAttachmentKey(key);
    return parsed?.type === 'note' && parsed.noteId === noteId;
  });
}
