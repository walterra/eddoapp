import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  buildAttachmentKey,
  getAttachmentKeys,
  validateAttachment,
  type AttachmentType,
  type AttachmentValidationResult,
} from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';
import { recentMutations } from './use_recent_mutations';

/** Result of an attachment upload operation */
export interface UploadAttachmentResult {
  /** CouchDB attachment key */
  key: string;
  /** File name */
  filename: string;
  /** MIME type */
  contentType: string;
  /** Size in bytes */
  size: number;
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
}

/** Parameters for deleting an attachment */
export interface DeleteAttachmentParams {
  /** Todo document ID */
  todoId: string;
  /** Attachment key to delete */
  key: string;
}

/** Parameters for fetching an attachment */
export interface GetAttachmentParams {
  /** Todo document ID */
  todoId: string;
  /** Attachment key */
  key: string;
}

/** Creates upload mutation for attachments */
function useUploadMutation(
  rawDb: PouchDB.Database,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return useMutation<UploadAttachmentResult, Error, UploadAttachmentParams>({
    mutationFn: async ({ todoId, file, type, noteId }) => {
      const validation = validateAttachment(file.size, file.type);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const key = buildAttachmentKey(type, file.name, noteId);
      const doc = await rawDb.get(todoId);
      await rawDb.putAttachment(todoId, key, doc._rev!, file, file.type);

      return { key, filename: file.name, contentType: file.type, size: file.size };
    },
    onSuccess: (_, { todoId }) => {
      recentMutations.add(todoId);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

/** Creates delete mutation for attachments */
function useDeleteMutation(
  rawDb: PouchDB.Database,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return useMutation<void, Error, DeleteAttachmentParams>({
    mutationFn: async ({ todoId, key }) => {
      const doc = await rawDb.get(todoId);
      await rawDb.removeAttachment(todoId, key, doc._rev!);
    },
    onSuccess: (_, { todoId }) => {
      recentMutations.add(todoId);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

/**
 * Hook for managing PouchDB attachments on todo documents.
 * Provides upload, delete, get, and list operations.
 */
export function useAttachment() {
  const { rawDb } = usePouchDb();
  const queryClient = useQueryClient();

  const uploadMutation = useUploadMutation(rawDb, queryClient);
  const deleteMutation = useDeleteMutation(rawDb, queryClient);

  const getAttachment = useCallback(
    async ({ todoId, key }: GetAttachmentParams): Promise<Blob> => {
      return (await rawDb.getAttachment(todoId, key)) as Blob;
    },
    [rawDb],
  );

  const listAttachments = useCallback(
    async (todoId: string): Promise<readonly string[]> => {
      const doc = await rawDb.get(todoId, { attachments: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return getAttachmentKeys((doc as any)._attachments);
    },
    [rawDb],
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
      validate,
      isUploading: uploadMutation.isPending,
      isDeleting: deleteMutation.isPending,
      uploadError: uploadMutation.error,
      deleteError: deleteMutation.error,
    }),
    [uploadMutation, deleteMutation, getAttachment, listAttachments, validate],
  );
}
