/**
 * Enhanced safe database operations with health monitoring integration
 */
import { DatabaseHealthMonitor } from './database-health-monitor';
import { SafeDbOperations, createSafeDbOperations } from './safe-db-operations';

export interface SafeDbOperationsWithHealth extends SafeDbOperations {
  /** Health monitor instance */
  healthMonitor: DatabaseHealthMonitor;
}

/**
 * Create safe database operations enhanced with health monitoring
 */
export const createSafeDbOperationsWithHealth = (
  db: PouchDB.Database,
  healthMonitor: DatabaseHealthMonitor,
): SafeDbOperationsWithHealth => {
  const baseSafeOps = createSafeDbOperations(db);

  // Wrap each operation to track success/failure for health monitoring
  const wrapGet = <T>(operation: typeof baseSafeOps.safeGet) => {
    return async (id: string): Promise<T | null> => {
      const startTime = Date.now();
      try {
        const result = await operation<T>(id);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  const wrapPut = <T>(operation: typeof baseSafeOps.safePut) => {
    return async (doc: T & { _id: string }): Promise<T & { _rev: string }> => {
      const startTime = Date.now();
      try {
        const result = await operation(doc);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  const wrapRemove = (operation: typeof baseSafeOps.safeRemove) => {
    return async (doc: { _id: string; _rev: string }): Promise<void> => {
      const startTime = Date.now();
      try {
        const result = await operation(doc);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  const wrapAllDocs = <T>(operation: typeof baseSafeOps.safeAllDocs) => {
    return async (options?: PouchDB.Core.AllDocsOptions): Promise<T[]> => {
      const startTime = Date.now();
      try {
        const result = await operation<T>(options);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  const wrapBulkDocs = <T extends { _id?: string; _rev?: string }>(
    operation: typeof baseSafeOps.safeBulkDocs,
  ) => {
    return async (docs: T[]): Promise<(T & { _rev: string })[]> => {
      const startTime = Date.now();
      try {
        const result = await operation<T>(docs);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  const wrapQuery = <T>(operation: typeof baseSafeOps.safeQuery) => {
    return async (
      designDoc: string,
      viewName: string,
      options?: PouchDB.Query.Options<
        Record<string, unknown>,
        Record<string, unknown>
      >,
    ): Promise<T[]> => {
      const startTime = Date.now();
      try {
        const result = await operation<T>(designDoc, viewName, options);
        const responseTime = Date.now() - startTime;
        healthMonitor.recordSuccessfulOperation(responseTime);
        return result;
      } catch (error) {
        healthMonitor.recordFailedOperation();
        throw error;
      }
    };
  };

  return {
    safeGet: wrapGet(baseSafeOps.safeGet),
    safePut: wrapPut(baseSafeOps.safePut),
    safeRemove: wrapRemove(baseSafeOps.safeRemove),
    safeAllDocs: wrapAllDocs(baseSafeOps.safeAllDocs),
    safeBulkDocs: wrapBulkDocs(baseSafeOps.safeBulkDocs),
    safeQuery: wrapQuery(baseSafeOps.safeQuery),
    healthMonitor,
  };
};
