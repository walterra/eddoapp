import {
  DatabaseError,
  DatabaseErrorType,
  DatabaseOperationError,
} from '@eddo/core-shared/types/database-errors';

/** Configuration for retry behavior */
type RetryConfig = { maxRetries: number; baseDelay: number; maxDelay: number };

const DEFAULT_RETRY_CONFIG: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 };

/** Error names/statuses that should never retry */
const NON_RETRYABLE = { names: ['conflict'], statuses: [401, 403] };

/** Check if error is a fetch TypeError */
const isFetchError = (err: Record<string, unknown>): boolean =>
  err.name === 'TypeError' && typeof err.message === 'string' && err.message.includes('fetch');

/** Check if status indicates server error */
const isServerError = (status: unknown): boolean =>
  typeof status === 'number' && status >= 500 && status < 600;

/** Determines if an error should trigger a retry */
const isRetryableError = (error: unknown): boolean => {
  const err = error as Record<string, unknown>;
  if (NON_RETRYABLE.names.includes(err.name as string)) return false;
  if (NON_RETRYABLE.statuses.includes(err.status as number)) return false;
  if (isFetchError(err) || err.name === 'timeout') return true;
  return isServerError(err.status) || err.status === 429;
};

/** Map error name/status to DatabaseErrorType */
const getErrorType = (
  err: Record<string, unknown>,
): { type: DatabaseErrorType; retryable: boolean } => {
  if (err.name === 'quota_exceeded')
    return { type: DatabaseErrorType.QUOTA_EXCEEDED, retryable: false };
  if (err.name === 'conflict') return { type: DatabaseErrorType.SYNC_CONFLICT, retryable: false };
  if (isFetchError(err)) return { type: DatabaseErrorType.NETWORK_ERROR, retryable: true };
  if (typeof err.status === 'number' && err.status >= 500)
    return { type: DatabaseErrorType.NETWORK_ERROR, retryable: true };
  return { type: DatabaseErrorType.OPERATION_FAILED, retryable: false };
};

/** Creates a structured database error from a raw error */
const createDatabaseError = (
  error: unknown,
  operation: string,
  documentId?: string,
): DatabaseError => {
  const err = error as Record<string, unknown>;
  const { type, retryable } = getErrorType(err);
  const msg = `Database operation "${operation}" failed: ${err.message || 'Unknown error'}`;
  return new DatabaseOperationError(type, msg, {
    originalError: err as unknown as Error,
    operation,
    document: documentId,
    retryable,
  });
};

/** Executes an operation with exponential backoff retry logic */
const withRetry = async <T>(
  op: () => Promise<T>,
  opName: string,
  docId?: string,
  cfg: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> => {
  let lastError: Error;
  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await op();
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableError(error) || attempt === cfg.maxRetries) throw error;
      const delay = Math.min(cfg.baseDelay * Math.pow(2, attempt - 1), cfg.maxDelay);
      console.warn(
        `Database "${opName}"${docId ? ` for "${docId}"` : ''} failed (${attempt}/${cfg.maxRetries}). Retry in ${delay}ms...`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
};

/** Process allDocs result to extract documents */
const extractDocs = <T>(result: PouchDB.Core.AllDocsResponse<Record<string, unknown>>): T[] =>
  result.rows.filter((row) => row.doc).map((row) => row.doc as T);

/** Process query result row with include_docs */
const processQueryRow = <T>(row: PouchDB.Query.Response<Record<string, unknown>>['rows'][0]): T => {
  const value = row.value as Record<string, unknown> | null;
  const doc = row.doc as Record<string, unknown>;
  return value == null ? (doc as T) : ({ ...value, doc, id: row.id } as T);
};

/** Process bulkDocs results */
const processBulkResults = <T extends { _id?: string; _rev?: string }>(
  results: Array<{ ok?: boolean; id?: string; rev?: string; error?: string }>,
  docs: T[],
): { successful: (T & { _rev: string })[]; errors: DatabaseError[] } => {
  const successful: (T & { _rev: string })[] = [];
  const errors: DatabaseError[] = [];
  results.forEach((result, i) => {
    if (result.error)
      errors.push(
        createDatabaseError(new Error(result.error), 'bulkDocs', docs[i]?._id || `doc-${i}`),
      );
    else if (result.rev) successful.push({ ...docs[i], _rev: result.rev } as T & { _rev: string });
  });
  return { successful, errors };
};

/** Create safeGet operation */
const createSafeGet =
  (db: PouchDB.Database) =>
  async <T>(id: string): Promise<T | null> => {
    try {
      return await withRetry(() => db.get<T>(id), 'get', id);
    } catch (error) {
      if ((error as { name?: string }).name === 'not_found') return null;
      throw createDatabaseError(error, 'get', id);
    }
  };

/** Create safePut operation */
const createSafePut =
  (db: PouchDB.Database) =>
  async <T>(doc: T & { _id: string }): Promise<T & { _rev: string }> => {
    try {
      const result = await withRetry(() => db.put(doc), 'put', doc._id);
      return { ...doc, _rev: result.rev };
    } catch (error) {
      throw createDatabaseError(error, 'put', doc._id);
    }
  };

/** Create safeRemove operation */
const createSafeRemove =
  (db: PouchDB.Database) =>
  async (doc: { _id: string; _rev: string }): Promise<void> => {
    try {
      await withRetry(() => db.remove(doc), 'remove', doc._id);
    } catch (error) {
      throw createDatabaseError(error, 'remove', doc._id);
    }
  };

/** Create safeAllDocs operation */
const createSafeAllDocs =
  (db: PouchDB.Database) =>
  async <T>(options: PouchDB.Core.AllDocsOptions = {}): Promise<T[]> => {
    try {
      const result = await withRetry(
        () => db.allDocs({ include_docs: true, ...options }),
        'allDocs',
      );
      return extractDocs<T>(result);
    } catch (error) {
      throw createDatabaseError(error, 'allDocs');
    }
  };

/** Create safeBulkDocs operation */
const createSafeBulkDocs =
  (db: PouchDB.Database) =>
  async <T extends { _id?: string; _rev?: string }>(
    docs: T[],
  ): Promise<(T & { _rev: string })[]> => {
    try {
      const results = (await withRetry(
        () => db.bulkDocs(docs as PouchDB.Core.PutDocument<Record<string, unknown>>[]),
        'bulkDocs',
      )) as Array<{
        ok?: boolean;
        id?: string;
        rev?: string;
        error?: string;
      }>;
      const { successful, errors } = processBulkResults(results, docs);
      if (errors.length > 0) console.warn('Some documents failed to save:', errors);
      return successful;
    } catch (error) {
      throw createDatabaseError(error, 'bulkDocs');
    }
  };

type QueryOptions = PouchDB.Query.Options<Record<string, unknown>, Record<string, unknown>>;

/** Create safeQuery operation */
const createSafeQuery =
  (db: PouchDB.Database) =>
  async <T>(designDoc: string, viewName: string, options: QueryOptions = {}): Promise<T[]> => {
    const view = `${designDoc}/${viewName}`;
    try {
      const result = await withRetry(() => db.query(view, options), 'query', view);
      if (options.include_docs)
        return result.rows.filter((row) => row.doc).map((row) => processQueryRow<T>(row));
      return result.rows.map((row) => row.value as T);
    } catch (error) {
      throw createDatabaseError(error, 'query', view);
    }
  };

type FindOptions = Omit<PouchDB.Find.FindRequest<Record<string, unknown>>, 'selector'>;

/** Create safeFind operation */
const createSafeFind =
  (db: PouchDB.Database) =>
  async <T>(selector: PouchDB.Find.Selector, options: FindOptions = {}): Promise<T[]> => {
    try {
      const result = await withRetry(
        () => db.find({ selector, ...options }),
        'find',
        JSON.stringify(selector).slice(0, 50),
      );
      return result.docs as T[];
    } catch (error) {
      throw createDatabaseError(error, 'find');
    }
  };

/** Creates safe database operation methods */
export const createSafeDbOperations = (db: PouchDB.Database) => ({
  safeGet: createSafeGet(db),
  safePut: createSafePut(db),
  safeRemove: createSafeRemove(db),
  safeAllDocs: createSafeAllDocs(db),
  safeBulkDocs: createSafeBulkDocs(db),
  safeQuery: createSafeQuery(db),
  safeFind: createSafeFind(db),
});

export type SafeDbOperations = ReturnType<typeof createSafeDbOperations>;
