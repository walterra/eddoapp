import { useCallback, useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useAuth } from './use_auth';
import {
  createRemoteDb,
  isAuthError,
  preWarmIndexes,
  SYNC_OPTIONS,
} from './use_couchdb_sync_helpers';

export const useCouchDbSync = () => {
  const { sync, healthMonitor, rawDb } = usePouchDb();
  const { authToken, logout } = useAuth();

  const handleAuthError = useCallback(() => {
    console.warn('Sync authentication failed - token may be expired');
    healthMonitor.updateSyncStatus('error');
    logout();
  }, [healthMonitor, logout]);

  useEffect(() => {
    if (!authToken) return;

    let isCancelled = false;
    const remoteDb = createRemoteDb(authToken.token);

    const syncHandler = sync(remoteDb, SYNC_OPTIONS);

    syncHandler.on('error', (error) => {
      console.error('Sync error:', error);
      if (isAuthError(error)) {
        handleAuthError();
      }
      healthMonitor.updateSyncStatus('error');
    });

    syncHandler.on('active', () => {
      healthMonitor.updateSyncStatus('syncing');
    });

    syncHandler.on('complete', () => {
      healthMonitor.updateSyncStatus('connected');
    });

    syncHandler.on('paused', async () => {
      healthMonitor.updateSyncStatus('connected');
      await preWarmIndexes(rawDb, () => isCancelled);
    });

    healthMonitor.updateSyncStatus('syncing');

    return () => {
      isCancelled = true;
      syncHandler.cancel();
      remoteDb.close();
      healthMonitor.updateSyncStatus('disconnected');
    };
  }, [sync, authToken, handleAuthError, healthMonitor, rawDb]);
};
