import { DatabaseHealthMonitor, getUserDbName, validateClientEnv } from '@eddo/core-client';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import { useContext } from 'react';

import { createSafeDbOperations } from './api/safe-db-operations';
import { PouchDbContext, type PouchDbContextType } from './pouch_db_types';

// Enable the find plugin
PouchDB.plugin(PouchDBFind);

// Get environment configuration for database naming
const env = validateClientEnv(import.meta.env);

/**
 * Create a PouchDB context for a specific user
 * This creates user-specific database instances that match server-side naming
 */
export function createUserPouchDbContext(username: string): PouchDbContextType {
  const dbName = getUserDbName(username, env);
  const pouchDb = new PouchDB(dbName, {
    revs_limit: 5,
    auto_compaction: true,
  });
  const safeDbOperations = createSafeDbOperations(pouchDb);
  const healthMonitor = new DatabaseHealthMonitor(pouchDb);

  return {
    safeDb: safeDbOperations,
    changes: pouchDb.changes.bind(pouchDb),
    sync: pouchDb.sync.bind(pouchDb),
    healthMonitor,
    rawDb: pouchDb,
  };
}

export const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};
