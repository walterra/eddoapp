import type { DatabaseHealthMonitor } from '@eddo/core-client';
// @ts-expect-error - Used for type namespace access
import type PouchDB from 'pouchdb-browser';
import { createContext } from 'react';

import type { SafeDbOperations } from './api/safe-db-operations';

// Use the official PouchDB type definitions
export type PouchDbDatabase = PouchDB.Database;
export type PouchDbChangesOptions = PouchDB.Core.ChangesOptions;
export type PouchDbChangesResult = PouchDB.Core.Changes<Record<string, unknown>>;
export type PouchDbSyncOptions = PouchDB.Replication.SyncOptions;
export type PouchDbSyncResult = PouchDB.Replication.Sync<Record<string, unknown>>;

// Main context type for PouchDB operations using proper PouchDB types
export type PouchDbContextType = {
  safeDb: SafeDbOperations;
  changes: (options?: PouchDbChangesOptions) => PouchDbChangesResult;
  sync: (remoteDb: PouchDbDatabase | string, options?: PouchDbSyncOptions) => PouchDbSyncResult;
  healthMonitor: DatabaseHealthMonitor;
  rawDb: PouchDbDatabase;
  /** Attachments database (separate from todos) */
  attachmentsDb: PouchDbDatabase;
};

export const PouchDbContext = createContext<PouchDbContextType | null>(null);
