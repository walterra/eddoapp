import {
  DatabaseHealthMonitor,
  SafeDbOperations,
  createSafeDbOperations,
  getEffectiveDbName,
  validateEnv,
} from '@eddo/shared';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import { createContext, useContext } from 'react';

// Enable the find plugin
PouchDB.plugin(PouchDBFind);

// Get environment configuration for database naming
const env = validateEnv(process.env);
const dbName = getEffectiveDbName(env);

const pouchDb = new PouchDB(dbName);
const safeDbOperations = createSafeDbOperations(pouchDb);
const healthMonitor = new DatabaseHealthMonitor(pouchDb);

export type PouchDbContextType = {
  safeDb: SafeDbOperations;
  changes: typeof pouchDb.changes;
  sync: typeof pouchDb.sync;
  healthMonitor: DatabaseHealthMonitor;
  rawDb: typeof pouchDb;
};

export const pouchDbContextValue: PouchDbContextType = {
  safeDb: safeDbOperations,
  changes: pouchDb.changes.bind(pouchDb),
  sync: pouchDb.sync.bind(pouchDb),
  healthMonitor,
  rawDb: pouchDb,
};

export const PouchDbContext = createContext<PouchDbContextType | null>(null);

export const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};
