import {
  DatabaseHealthMonitor,
  createSafeDbOperations,
  getEffectiveDbName,
  validateEnv,
} from '@eddo/core';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import { useContext } from 'react';

import { PouchDbContext, type PouchDbContextType } from './pouch_db_types';

// Enable the find plugin
PouchDB.plugin(PouchDBFind);

// Get environment configuration for database naming
const env = validateEnv(import.meta.env);
const dbName = getEffectiveDbName(env);

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
