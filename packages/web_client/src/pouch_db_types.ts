import type { DatabaseHealthMonitor, SafeDbOperations } from '@eddo/core';
import type PouchDB from 'pouchdb-browser';
import { createContext } from 'react';

// Use the official PouchDB type definitions
export type PouchDbDatabase = PouchDB.Database;
export type PouchDbChangesOptions = PouchDB.Core.ChangesOptions;
export type PouchDbChangesResult = PouchDB.Core.Changes<
  Record<string, unknown>
>;
export type PouchDbSyncOptions = PouchDB.Replication.SyncOptions;
export type PouchDbSyncResult = PouchDB.Replication.Sync<
  Record<string, unknown>
>;

// Main context type for PouchDB operations using proper PouchDB types
export type PouchDbContextType = {
  safeDb: SafeDbOperations;
  changes: (options?: PouchDbChangesOptions) => PouchDbChangesResult;
  sync: (
    remoteDb: PouchDbDatabase | string,
    options?: PouchDbSyncOptions,
  ) => PouchDbSyncResult;
  healthMonitor: DatabaseHealthMonitor;
  rawDb: PouchDbDatabase;
};

export const PouchDbContext = createContext<PouchDbContextType | null>(null);
