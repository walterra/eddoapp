import {
  DatabaseHealthMonitor,
  getClientDbName,
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
const dbName = getClientDbName(env);

const pouchDb = new PouchDB(dbName);
const safeDbOperations = createSafeDbOperations(pouchDb);
const healthMonitor = new DatabaseHealthMonitor(pouchDb);

export const pouchDbContextValue: PouchDbContextType = {
  safeDb: safeDbOperations,
  changes: pouchDb.changes.bind(pouchDb),
  sync: pouchDb.sync.bind(pouchDb),
  healthMonitor,
  rawDb: pouchDb,
};

export const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};
