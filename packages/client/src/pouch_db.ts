import { SafeDbOperations, createSafeDbOperations } from '@eddo/shared';
import PouchDB from 'pouchdb-browser';
import { createContext, useContext } from 'react';

const pouchDb = new PouchDB('todos');
const safeDbOperations = createSafeDbOperations(pouchDb);

export type PouchDbContextType = {
  safeDb: SafeDbOperations;
  changes: typeof pouchDb.changes;
  sync: typeof pouchDb.sync;
};

export const pouchDbContextValue: PouchDbContextType = {
  safeDb: safeDbOperations,
  changes: pouchDb.changes.bind(pouchDb),
  sync: pouchDb.sync.bind(pouchDb),
};

export const PouchDbContext = createContext<PouchDbContextType | null>(null);

export const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};
