/**
 * Attachment Tools - Upload, get, delete, and list attachments
 * Uses a separate attachments database, decoupled from todo documents
 */
import {
  buildAttachmentDocId,
  validateAttachment,
  type AttachmentDoc,
  type AttachmentType,
} from '@eddo/core-shared';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetAttachmentsDb, ToolContext } from './types.js';

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

export const uploadAttachmentDescription = `Upload an attachment to a todo. Attachments are stored in a separate database, decoupled from todo documents. Attachments can be added to the description (type: 'desc') or to a specific note (type: 'note'). Supported types: JPEG, PNG, GIF, WebP images and PDF documents. Maximum size: 5MB. The attachment can be referenced in markdown as ![alt](attachment:desc/filename.png).`;

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

/** Creates attachment document with optional existing revision */
async function createAttachmentDoc(
  db: ReturnType<GetAttachmentsDb>,
  args: UploadAttachmentArgs,
  docId: string,
  size: number,
): Promise<AttachmentDoc> {
  const doc: AttachmentDoc = {
    _id: docId,
    todoId: args.todoId,
    type: args.type as AttachmentType,
    noteId: args.noteId,
    filename: args.filename,
    contentType: args.contentType,
    size,
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = await db.get(docId);
    doc._rev = existing._rev;
  } catch {
    // Document doesn't exist, that's fine
  }

  return doc;
}

/** Uploads an attachment to the attachments database */
export async function executeUploadAttachment(
  args: UploadAttachmentArgs,
  context: ToolContext,
  getAttachmentsDb: GetAttachmentsDb,
): Promise<string> {
  const db = getAttachmentsDb(context);
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

    const docId = buildAttachmentDocId(
      args.todoId,
      args.type as AttachmentType,
      args.filename,
      args.noteId,
    );
    const attachmentDoc = await createAttachmentDoc(db, args, docId, buffer.length);
    const result = await db.insert(attachmentDoc);
    await db.attachment.insert(docId, 'file', buffer, args.contentType, { rev: result.rev });

    const attachmentPath = docId.split('/').slice(1).join('/');
    context.log.info('Attachment uploaded', { docId, size: buffer.length });

    return createSuccessResponse({
      summary: 'Attachment uploaded successfully',
      data: {
        docId,
        todoId: args.todoId,
        filename: args.filename,
        contentType: args.contentType,
        size: buffer.length,
        markdownRef: `![${args.filename}](attachment:${attachmentPath})`,
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

export const getAttachmentDescription = `Get an attachment as base64 encoded data. Use the docId returned from listAttachments or uploadAttachment.`;

export const getAttachmentParameters = z.object({
  docId: z.string().describe("The attachment document ID (e.g., 'todoId/desc/screenshot.png')"),
});

export type GetAttachmentArgs = z.infer<typeof getAttachmentParameters>;

/** Gets an attachment as base64 */
export async function executeGetAttachment(
  args: GetAttachmentArgs,
  context: ToolContext,
  getAttachmentsDb: GetAttachmentsDb,
): Promise<string> {
  const db = getAttachmentsDb(context);
  const operation = 'get_attachment';
  context.log.info('Getting attachment', { docId: args.docId });

  try {
    const startTime = Date.now();

    // Get attachment document for metadata
    const doc = await db.get(args.docId);

    // Get the actual blob
    const buffer = await db.attachment.get(args.docId, 'file');

    const base64Data = Buffer.from(buffer).toString('base64');
    context.log.info('Attachment retrieved', { docId: args.docId });

    return createSuccessResponse({
      summary: 'Attachment retrieved successfully',
      data: {
        docId: args.docId,
        todoId: doc.todoId,
        filename: doc.filename,
        contentType: doc.contentType,
        size: doc.size,
        base64Data,
      },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to get attachment',
      error,
      operation,
      recoverySuggestions: [
        'Verify the attachment document ID exists',
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
  docId: z
    .string()
    .describe("The attachment document ID to delete (e.g., 'todoId/desc/screenshot.png')"),
});

export type DeleteAttachmentArgs = z.infer<typeof deleteAttachmentParameters>;

/** Deletes an attachment document */
export async function executeDeleteAttachment(
  args: DeleteAttachmentArgs,
  context: ToolContext,
  getAttachmentsDb: GetAttachmentsDb,
): Promise<string> {
  const db = getAttachmentsDb(context);
  const operation = 'delete_attachment';
  context.log.info('Deleting attachment', { docId: args.docId });

  try {
    const startTime = Date.now();
    const doc = await db.get(args.docId);
    await db.destroy(args.docId, doc._rev!);

    context.log.info('Attachment deleted', { docId: args.docId });

    return createSuccessResponse({
      summary: 'Attachment deleted successfully',
      data: { deletedDocId: args.docId, todoId: doc.todoId },
      operation,
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to delete attachment',
      error,
      operation,
      recoverySuggestions: [
        'Verify the attachment document ID exists',
        'Use listAttachments to see available attachments',
      ],
    });
  }
}

// ============================================================================
// LIST ATTACHMENTS
// ============================================================================

export const listAttachmentsDescription = `List all attachments for a todo. Returns attachment document IDs, content types, and sizes.`;

export const listAttachmentsParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo'),
});

export type ListAttachmentsArgs = z.infer<typeof listAttachmentsParameters>;

/** Builds attachment info from document */
function buildAttachmentInfo(doc: AttachmentDoc) {
  // Build markdown ref path (without todoId prefix)
  const pathParts = doc._id.split('/');
  const attachmentPath = pathParts.slice(1).join('/');

  return {
    docId: doc._id,
    type: doc.type,
    noteId: doc.noteId,
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    createdAt: doc.createdAt,
    markdownRef: `![${doc.filename}](attachment:${attachmentPath})`,
  };
}

/** Lists all attachments for a todo */
export async function executeListAttachments(
  args: ListAttachmentsArgs,
  context: ToolContext,
  getAttachmentsDb: GetAttachmentsDb,
): Promise<string> {
  const db = getAttachmentsDb(context);
  const operation = 'list_attachments';
  context.log.info('Listing attachments', { todoId: args.todoId });

  try {
    const startTime = Date.now();

    // Query for all documents starting with the todoId prefix
    const result = await db.list({
      startkey: `${args.todoId}/`,
      endkey: `${args.todoId}/\ufff0`,
      include_docs: true,
    });

    const attachments = result.rows
      .filter((row) => row.doc)
      .map((row) => buildAttachmentInfo(row.doc as AttachmentDoc));

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
