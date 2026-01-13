/**
 * Attachment Tools - Upload, get, delete, and list attachments on todos
 * Uses CouchDB native attachments with base64 encoding for MCP transport
 */
import {
  buildAttachmentKey,
  getAttachmentKeys,
  parseAttachmentKey,
  validateAttachment,
  type AttachmentType,
} from '@eddo/core-shared';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

interface UploadValidationParams {
  size: number;
  contentType: string;
  type: string;
  noteId: string | undefined;
}

/** Validates upload arguments and returns error response if invalid */
function validateUploadArgs(params: UploadValidationParams, operation: string): string | null {
  const validation = validateAttachment(params.size, params.contentType);
  if (!validation.valid) {
    return createErrorResponse({
      summary: 'Attachment validation failed',
      error: new Error(validation.error),
      operation,
      recoverySuggestions: [
        'Ensure file is under 5MB',
        'Use supported types: image/jpeg, image/png, image/gif, image/webp, application/pdf',
      ],
    });
  }

  if (params.type === 'note' && !params.noteId) {
    return createErrorResponse({
      summary: 'Note ID required',
      error: new Error('noteId is required when type is "note"'),
      operation,
      recoverySuggestions: ['Provide noteId parameter for note attachments'],
    });
  }

  return null;
}

// ============================================================================
// UPLOAD ATTACHMENT
// ============================================================================

export const uploadAttachmentDescription = `Upload an attachment to a todo. Attachments can be added to the description (type: 'desc') or to a specific note (type: 'note'). Supported types: JPEG, PNG, GIF, WebP images and PDF documents. Maximum size: 5MB. The attachment can be referenced in markdown as ![alt](attachment:key).`;

export const uploadAttachmentParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo'),
  filename: z.string().describe('The filename for the attachment (e.g., screenshot.png)'),
  base64Data: z.string().describe('The file content encoded as base64'),
  contentType: z.string().describe('The MIME type (e.g., image/png, image/jpeg, application/pdf)'),
  type: z
    .enum(['desc', 'note'])
    .describe("Attachment location: 'desc' for description, 'note' for a specific note"),
  noteId: z.string().optional().describe("Required if type is 'note': the note ID to attach to"),
});

export type UploadAttachmentArgs = z.infer<typeof uploadAttachmentParameters>;

/** Uploads an attachment to a todo */
export async function executeUploadAttachment(
  args: UploadAttachmentArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const operation = 'upload_attachment';
  context.log.info('Uploading attachment', { todoId: args.todoId, filename: args.filename });

  try {
    const startTime = Date.now();
    const buffer = Buffer.from(args.base64Data, 'base64');

    const validationError = validateUploadArgs(
      { size: buffer.length, contentType: args.contentType, type: args.type, noteId: args.noteId },
      operation,
    );
    if (validationError) return validationError;

    const key = buildAttachmentKey(args.type as AttachmentType, args.filename, args.noteId);
    const todo = await db.get(args.todoId);
    await db.attachment.insert(args.todoId, key, buffer, args.contentType, { rev: todo._rev });

    context.log.info('Attachment uploaded', { todoId: args.todoId, key, size: buffer.length });

    return createSuccessResponse({
      summary: 'Attachment uploaded successfully',
      data: {
        todoId: args.todoId,
        key,
        filename: args.filename,
        contentType: args.contentType,
        size: buffer.length,
        markdownRef: `![${args.filename}](attachment:${key})`,
      },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to upload attachment',
      error,
      operation,
      recoverySuggestions: ['Verify the todo ID exists', 'Check file size and type'],
    });
  }
}

// ============================================================================
// GET ATTACHMENT
// ============================================================================

export const getAttachmentDescription = `Get an attachment from a todo as base64 encoded data. Use the key returned from listAttachments or uploadAttachment.`;

export const getAttachmentParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo'),
  key: z.string().describe("The attachment key (e.g., 'desc/screenshot.png')"),
});

export type GetAttachmentArgs = z.infer<typeof getAttachmentParameters>;

/** Gets an attachment from a todo as base64 */
export async function executeGetAttachment(
  args: GetAttachmentArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const operation = 'get_attachment';
  context.log.info('Getting attachment', { todoId: args.todoId, key: args.key });

  try {
    const startTime = Date.now();
    const buffer = await db.attachment.get(args.todoId, args.key);

    const todo = await db.get(args.todoId, { attachments: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachments = (todo as any)._attachments ?? {};
    const contentType = attachments[args.key]?.content_type ?? 'application/octet-stream';

    const base64Data = Buffer.from(buffer).toString('base64');
    context.log.info('Attachment retrieved', { todoId: args.todoId, key: args.key });

    return createSuccessResponse({
      summary: 'Attachment retrieved successfully',
      data: { todoId: args.todoId, key: args.key, contentType, size: buffer.length, base64Data },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to get attachment',
      error,
      operation,
      recoverySuggestions: [
        'Verify the todo ID and attachment key exist',
        'Use listAttachments to see available attachments',
      ],
    });
  }
}

// ============================================================================
// DELETE ATTACHMENT
// ============================================================================

export const deleteAttachmentDescription = `Delete an attachment from a todo.`;

export const deleteAttachmentParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo'),
  key: z.string().describe("The attachment key to delete (e.g., 'desc/screenshot.png')"),
});

export type DeleteAttachmentArgs = z.infer<typeof deleteAttachmentParameters>;

/** Deletes an attachment from a todo */
export async function executeDeleteAttachment(
  args: DeleteAttachmentArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const operation = 'delete_attachment';
  context.log.info('Deleting attachment', { todoId: args.todoId, key: args.key });

  try {
    const startTime = Date.now();
    const todo = await db.get(args.todoId);
    await db.attachment.destroy(args.todoId, args.key, { rev: todo._rev! });

    context.log.info('Attachment deleted', { todoId: args.todoId, key: args.key });

    return createSuccessResponse({
      summary: 'Attachment deleted successfully',
      data: { todoId: args.todoId, deletedKey: args.key },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to delete attachment',
      error,
      operation,
      recoverySuggestions: [
        'Verify the todo ID and attachment key exist',
        'Use listAttachments to see available attachments',
      ],
    });
  }
}

// ============================================================================
// LIST ATTACHMENTS
// ============================================================================

export const listAttachmentsDescription = `List all attachments on a todo. Returns attachment keys, content types, and sizes.`;

export const listAttachmentsParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo'),
});

export type ListAttachmentsArgs = z.infer<typeof listAttachmentsParameters>;

/** Builds attachment info from key and metadata */
function buildAttachmentInfo(key: string, info: { content_type?: string; length?: number }) {
  const parsed = parseAttachmentKey(key);
  return {
    key,
    type: parsed?.type ?? 'unknown',
    noteId: parsed?.noteId,
    filename: parsed?.filename ?? key,
    contentType: info?.content_type ?? 'unknown',
    size: info?.length ?? 0,
    markdownRef: `![](attachment:${key})`,
  };
}

/** Lists all attachments on a todo */
export async function executeListAttachments(
  args: ListAttachmentsArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const operation = 'list_attachments';
  context.log.info('Listing attachments', { todoId: args.todoId });

  try {
    const startTime = Date.now();
    const todo = await db.get(args.todoId, { attachments: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachmentsObj = (todo as any)._attachments ?? {};
    const keys = getAttachmentKeys(attachmentsObj);
    const attachments = keys.map((key) => buildAttachmentInfo(key, attachmentsObj[key]));

    context.log.info('Attachments listed', { todoId: args.todoId, count: attachments.length });

    return createSuccessResponse({
      summary: `Found ${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}`,
      data: { todoId: args.todoId, count: attachments.length, attachments },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to list attachments',
      error,
      operation,
      recoverySuggestions: ['Verify the todo ID exists'],
    });
  }
}
