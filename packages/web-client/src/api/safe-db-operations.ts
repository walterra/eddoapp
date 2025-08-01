import {
  DatabaseError,
  DatabaseErrorType,
  DatabaseOperationError,
} from '@eddo/core-shared/types/database-errors';

/** Configuration for retry behavior */
type RetryConfig = {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
};

/** Determines if an error should trigger a retry */
const isRetryableError = (error: unknown): boolean => {
  const err = error as Record<string, unknown>;
  if (
    err.name === 'TypeError' &&
    typeof err.message === 'string' &&
    err.message.includes('fetch')
  ) {
    return true;
  }

  if (err.name === 'timeout') {
    return true;
  }

  if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) {
    return true;
  }

  if (err.status === 429) {
    return true;
  }

  if (err.name === 'conflict') {
    return false;
  }

  if (err.status === 401 || err.status === 403) {
    return false;
  }

  return false;
};

/** Creates a structured database error from a raw error */
const createDatabaseError = (
  error: unknown,
  operation: string,
  documentId?: string,
): DatabaseError => {
  let type: DatabaseErrorType;
  let retryable = false;

  const err = error as Record<string, unknown>;
  switch (err.name) {
    case 'quota_exceeded':
      type = DatabaseErrorType.QUOTA_EXCEEDED;
      break;
    case 'conflict':
      type = DatabaseErrorType.SYNC_CONFLICT;
      break;
    case 'TypeError':
      if (typeof err.message === 'string' && err.message.includes('fetch')) {
        type = DatabaseErrorType.NETWORK_ERROR;
        retryable = true;
      } else {
        type = DatabaseErrorType.OPERATION_FAILED;
      }
      break;
    default:
      if (typeof err.status === 'number' && err.status >= 500) {
        type = DatabaseErrorType.NETWORK_ERROR;
        retryable = true;
      } else {
        type = DatabaseErrorType.OPERATION_FAILED;
      }
  }

  return new DatabaseOperationError(
    type,
    `Database operation "${operation}" failed: ${err.message || 'Unknown error'}`,
    {
      originalError: err as unknown as Error,
      operation,
      document: documentId,
      retryable,
    },
  );
};

/** Executes an operation with exponential backoff retry logic */
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  documentId?: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt === retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(2, attempt - 1),
        retryConfig.maxDelay,
      );

      console.warn(
        `Database operation "${operationName}"${documentId ? ` for document "${documentId}"` : ''} failed (attempt ${attempt}/${retryConfig.maxRetries}). Retrying in ${delay}ms...`,
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

/**
 * Creates a set of database operations with error handling and retry logic
 * @param db - PouchDB database instance
 * @returns Object with safe database operation methods
 */
export const createSafeDbOperations = (db: PouchDB.Database) => ({
  /** Get a document by ID, returns null if not found */
  safeGet: async <T>(id: string): Promise<T | null> => {
    try {
      return await withRetry(() => db.get<T>(id), 'get', id);
    } catch (error) {
      if ((error as { name?: string }).name === 'not_found') {
        return null;
      }
      throw createDatabaseError(error, 'get', id);
    }
  },

  /** Create or update a document */
  safePut: async <T>(
    doc: T & { _id: string },
  ): Promise<T & { _rev: string }> => {
    try {
      const result = await withRetry(() => db.put(doc), 'put', doc._id);

      return { ...doc, _rev: result.rev };
    } catch (error) {
      throw createDatabaseError(error, 'put', doc._id);
    }
  },

  /** Remove a document */
  safeRemove: async (doc: { _id: string; _rev: string }): Promise<void> => {
    try {
      await withRetry(() => db.remove(doc), 'remove', doc._id);
    } catch (error) {
      throw createDatabaseError(error, 'remove', doc._id);
    }
  },

  /** Fetch multiple documents with options */
  safeAllDocs: async <T>(
    options: PouchDB.Core.AllDocsOptions = {},
  ): Promise<T[]> => {
    try {
      const result = await withRetry(
        () => db.allDocs({ include_docs: true, ...options }),
        'allDocs',
      );

      return result.rows.filter((row) => row.doc).map((row) => row.doc as T);
    } catch (error) {
      throw createDatabaseError(error, 'allDocs');
    }
  },

  /** Bulk create/update documents, returns successful saves */
  safeBulkDocs: async <T extends { _id?: string; _rev?: string }>(
    docs: T[],
  ): Promise<(T & { _rev: string })[]> => {
    try {
      const results = (await withRetry(
        () =>
          db.bulkDocs(
            docs as PouchDB.Core.PutDocument<Record<string, unknown>>[],
          ),
        'bulkDocs',
      )) as Array<{ ok: boolean; id: string; rev: string } | { error: string }>;

      const successful: (T & { _rev: string })[] = [];
      const errors: DatabaseError[] = [];

      results.forEach((result, index) => {
        if ('error' in result) {
          errors.push(
            createDatabaseError(
              new Error(result.error),
              'bulkDocs',
              (docs[index] as { _id?: string })?._id || `doc-${index}`,
            ),
          );
        } else {
          successful.push({
            ...docs[index],
            _rev: result.rev,
          } as T & { _rev: string });
        }
      });

      if (errors.length > 0) {
        console.warn('Some documents failed to save:', errors);
      }

      return successful;
    } catch (error) {
      throw createDatabaseError(error, 'bulkDocs');
    }
  },

  /** Query a design document view */
  safeQuery: async <T>(
    designDoc: string,
    viewName: string,
    options: PouchDB.Query.Options<
      Record<string, unknown>,
      Record<string, unknown>
    > = {},
  ): Promise<T[]> => {
    try {
      const result = await withRetry(
        () => db.query(`${designDoc}/${viewName}`, options),
        'query',
        `${designDoc}/${viewName}`,
      );

      return result.rows.map((row) => row.value as T);
    } catch (error) {
      throw createDatabaseError(error, 'query', `${designDoc}/${viewName}`);
    }
  },
});

export type SafeDbOperations = ReturnType<typeof createSafeDbOperations>;
