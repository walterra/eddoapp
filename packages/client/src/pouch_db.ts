import PouchDB from 'pouchdb-browser';
import { createContext, useContext } from 'react';

import {
  SafeDbOperations,
  createSafeDbOperations,
} from '../../shared/src/api/safe-db-operations';

export const pouchDb = new PouchDB('todos');
export const safeDbOperations = createSafeDbOperations(pouchDb);

export type PouchDbContextType = PouchDB.Database & {
  safeDb: SafeDbOperations;
};

export const PouchDbContext = createContext<PouchDbContextType>({
  ...pouchDb,
  safeDb: safeDbOperations,
} as PouchDbContextType);

export const usePouchDb = () => {
  return useContext(PouchDbContext);
};
