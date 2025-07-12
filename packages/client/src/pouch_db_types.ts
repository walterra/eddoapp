import type { DatabaseHealthMonitor, SafeDbOperations } from '@eddo/shared';
import { createContext } from 'react';

export type PouchDbContextType = {
  safeDb: SafeDbOperations;
  changes: (options?: PouchDB.ChangesOptions) => PouchDB.Changes<{}>;
  sync: (remoteDb: PouchDB.Database, options?: PouchDB.Replication.SyncOptions) => PouchDB.Replication.Sync<{}>;
  healthMonitor: DatabaseHealthMonitor;
  rawDb: PouchDB.Database;
};

export const PouchDbContext = createContext<PouchDbContextType | null>(null);

