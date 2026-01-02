/**
 * Enhanced safe database operations with health monitoring integration
 */
import { DatabaseHealthMonitor } from '@eddo/core-shared/api/database-health-monitor';

import { SafeDbOperations, createSafeDbOperations } from './safe-db-operations';

export interface SafeDbOperationsWithHealth extends SafeDbOperations {
  healthMonitor: DatabaseHealthMonitor;
}

/** Track operation timing and health */
const trackOp = async <T>(fn: () => Promise<T>, monitor: DatabaseHealthMonitor): Promise<T> => {
  const start = Date.now();
  try {
    const result = await fn();
    monitor.recordSuccessfulOperation(Date.now() - start);
    return result;
  } catch (error) {
    monitor.recordFailedOperation();
    throw error;
  }
};

/** Create safe database operations enhanced with health monitoring */
export const createSafeDbOperationsWithHealth = (
  db: PouchDB.Database,
  healthMonitor: DatabaseHealthMonitor,
): SafeDbOperationsWithHealth => {
  const ops = createSafeDbOperations(db);

  return {
    safeGet: <T>(id: string) => trackOp(() => ops.safeGet<T>(id), healthMonitor),
    safePut: <T>(doc: T & { _id: string }) => trackOp(() => ops.safePut(doc), healthMonitor),
    safeRemove: (doc: { _id: string; _rev: string }) =>
      trackOp(() => ops.safeRemove(doc), healthMonitor),
    safeAllDocs: <T>(options?: PouchDB.Core.AllDocsOptions) =>
      trackOp(() => ops.safeAllDocs<T>(options), healthMonitor),
    safeBulkDocs: <T extends { _id?: string; _rev?: string }>(docs: T[]) =>
      trackOp(() => ops.safeBulkDocs(docs), healthMonitor),
    safeQuery: <T>(
      designDoc: string,
      viewName: string,
      options?: PouchDB.Query.Options<Record<string, unknown>, Record<string, unknown>>,
    ) => trackOp(() => ops.safeQuery<T>(designDoc, viewName, options), healthMonitor),
    safeFind: <T>(
      selector: PouchDB.Find.Selector,
      options?: Omit<PouchDB.Find.FindRequest<Record<string, unknown>>, 'selector'>,
    ) => trackOp(() => ops.safeFind<T>(selector, options), healthMonitor),
    healthMonitor,
  };
};
