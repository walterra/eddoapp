/**
 * Hook for managing attachments in the separate attachments database.
 * Attachments are stored as independent documents, decoupled from todo updates.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  buildAttachmentDocId,
  parseAttachmentDocId,
  validateAttachment,
  type AttachmentDoc,
  type AttachmentType,
  type AttachmentValidationResult,
} from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';
import { generateHashedFilename } from '../utils/file_hash';
import { compressImage } from '../utils/image_compression';

/** Result of an attachment upload operation */
export interface UploadAttachmentResult {
  /** Attachment document ID */
  docId: string;
  /** Hashed filename (e.g., "a1b2c3d4e5f6.png") */
  filename: string;
  /** Original filename before hashing */
  originalFilename: string;
  /** MIME type */
  contentType: string;
  /** Size in bytes */
  size: number;
  /** Original size before compression (if compressed) */
  originalSize?: number;
  /** Whether the file was compressed */
  wasCompressed: boolean;
}

/** Parameters for uploading an attachment */
export interface UploadAttachmentParams {
  /** Todo document ID */
  todoId: string;
  /** File to upload */
  file: File;
  /** Attachment type ('desc' for description, 'note' for note) */
  type: AttachmentType;
  /** Note ID (required if type is 'note') */
  noteId?: string;
  /** Whether to auto-compress images (default: true) */
  autoCompress?: boolean;
}

/** Parameters for deleting an attachment */
export interface DeleteAttachmentParams {
  /** Attachment document ID */
  docId: string;
}

/** Parameters for fetching an attachment */
export interface GetAttachmentParams {
  /** Attachment document ID */
  docId: string;
}

/** Compresses file if enabled and generates hashed filename */
async function prepareFileForUpload(file: File, autoCompress: boolean) {
  // First compress if needed
  const compressed = autoCompress ? await compressImage(file) : { file, wasCompressed: false };

  // Generate content-based hash filename
  const hashedName = await generateHashedFilename(compressed.file);

  // Create new file with hashed name
  const hashedFile = new File([compressed.file], hashedName, { type: compressed.file.type });

  return {
    file: hashedFile,
    originalName: file.name,
    wasCompressed: compressed.wasCompressed,
    originalSize: compressed.wasCompressed
      ? (compressed as { originalSize?: number }).originalSize
      : undefined,
  };
}

interface SaveAttachmentParams {
  db: PouchDB.Database;
  todoId: string;
  type: AttachmentType;
  file: File;
  noteId?: string;
}

/** Creates and saves attachment document */
async function saveAttachmentDoc(
  params: SaveAttachmentParams,
): Promise<{ docId: string; rev: string }> {
  const { db, todoId, type, file, noteId } = params;
  const docId = buildAttachmentDocId(todoId, type, file.name, noteId);

  const attachmentDoc: AttachmentDoc = {
    _id: docId,
    todoId,
    type,
    noteId,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };

  // Check for existing doc
  try {
    const existing = await db.get(docId);
    attachmentDoc._rev = existing._rev;
  } catch {
    // New document
  }

  const putResult = await db.put(attachmentDoc);
  return { docId, rev: putResult.rev };
}

/** Creates upload mutation for attachments with auto-compression */
function useUploadMutation(
  attachmentsDb: PouchDB.Database,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return useMutation<UploadAttachmentResult, Error, UploadAttachmentParams>({
    mutationFn: async ({ todoId, file, type, noteId, autoCompress = true }) => {
      const prepared = await prepareFileForUpload(file, autoCompress);
      const validation = validateAttachment(prepared.file.size, prepared.file.type);
      if (!validation.valid) throw new Error(validation.error);

      const { docId, rev } = await saveAttachmentDoc({
        db: attachmentsDb,
        todoId,
        type,
        file: prepared.file,
        noteId,
      });
      await attachmentsDb.putAttachment(docId, 'file', rev, prepared.file, prepared.file.type);

      return {
        docId,
        filename: prepared.file.name,
        originalFilename: prepared.originalName,
        contentType: prepared.file.type,
        size: prepared.file.size,
        originalSize: prepared.originalSize,
        wasCompressed: prepared.wasCompressed,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });
}

/** Creates delete mutation for attachments */
function useDeleteMutation(
  attachmentsDb: PouchDB.Database,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return useMutation<void, Error, DeleteAttachmentParams>({
    mutationFn: async ({ docId }) => {
      const doc = await attachmentsDb.get(docId);
      await attachmentsDb.remove(doc);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });
}

/** Hook for fetching and listing attachments */
function useAttachmentQueries(attachmentsDb: PouchDB.Database) {
  const getAttachment = useCallback(
    async ({ docId }: GetAttachmentParams): Promise<Blob> => {
      return (await attachmentsDb.getAttachment(docId, 'file')) as Blob;
    },
    [attachmentsDb],
  );

  const listAttachments = useCallback(
    async (todoId: string): Promise<readonly string[]> => {
      const result = await attachmentsDb.allDocs({
        startkey: `${todoId}/`,
        endkey: `${todoId}/\ufff0`,
        include_docs: false,
      });
      return result.rows.map((row) => row.id);
    },
    [attachmentsDb],
  );

  const listAttachmentDocs = useCallback(
    async (todoId: string): Promise<readonly AttachmentDoc[]> => {
      const result = await attachmentsDb.allDocs<AttachmentDoc>({
        startkey: `${todoId}/`,
        endkey: `${todoId}/\ufff0`,
        include_docs: true,
      });
      return result.rows.map((row) => row.doc!).filter(Boolean);
    },
    [attachmentsDb],
  );

  return { getAttachment, listAttachments, listAttachmentDocs };
}

/**
 * Hook for managing PouchDB attachments in a separate database.
 * Provides upload (with auto-compression), delete, get, and list operations.
 */
export function useAttachment() {
  const { attachmentsDb } = usePouchDb();
  const queryClient = useQueryClient();

  const uploadMutation = useUploadMutation(attachmentsDb, queryClient);
  const deleteMutation = useDeleteMutation(attachmentsDb, queryClient);
  const { getAttachment, listAttachments, listAttachmentDocs } =
    useAttachmentQueries(attachmentsDb);

  const deleteAllForTodo = useCallback(
    async (todoId: string): Promise<void> => {
      const docIds = await listAttachments(todoId);
      for (const docId of docIds) {
        try {
          const doc = await attachmentsDb.get(docId);
          await attachmentsDb.remove(doc);
        } catch {
          // Ignore individual deletion errors
        }
      }
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
    [attachmentsDb, listAttachments, queryClient],
  );

  const validate = useCallback((file: File): AttachmentValidationResult => {
    return validateAttachment(file.size, file.type);
  }, []);

  return useMemo(
    () => ({
      uploadAttachment: uploadMutation,
      deleteAttachment: deleteMutation,
      getAttachment,
      listAttachments,
      listAttachmentDocs,
      deleteAllForTodo,
      validate,
      isUploading: uploadMutation.isPending,
      isDeleting: deleteMutation.isPending,
      uploadError: uploadMutation.error,
      deleteError: deleteMutation.error,
    }),
    [
      uploadMutation,
      deleteMutation,
      getAttachment,
      listAttachments,
      listAttachmentDocs,
      deleteAllForTodo,
      validate,
    ],
  );
}

// Re-export for convenience
export { parseAttachmentDocId };
