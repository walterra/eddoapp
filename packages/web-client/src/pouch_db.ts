import {
  DatabaseHealthMonitor,
  getClientDbName,
  getUserDbName,
  validateClientEnv,
} from '@eddo/core-client';
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
  const pouchDb = new PouchDB(dbName);
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

/**
 * Legacy fallback context for unauthenticated state
 * @deprecated Should be replaced with user-specific context
 */
const fallbackDbName = getClientDbName(env);
const fallbackPouchDb = new PouchDB(fallbackDbName);
const fallbackSafeDbOperations = createSafeDbOperations(fallbackPouchDb);
const fallbackHealthMonitor = new DatabaseHealthMonitor(fallbackPouchDb);

export const pouchDbContextValue: PouchDbContextType = {
  safeDb: fallbackSafeDbOperations,
  changes: fallbackPouchDb.changes.bind(fallbackPouchDb),
  sync: fallbackPouchDb.sync.bind(fallbackPouchDb),
  healthMonitor: fallbackHealthMonitor,
  rawDb: fallbackPouchDb,
};

export const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};
