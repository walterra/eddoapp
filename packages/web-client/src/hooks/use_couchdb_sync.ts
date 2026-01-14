import { useCallback, useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { recordSyncEvent } from '../telemetry';
import { useAuth } from './use_auth';
import {
  createRemoteAttachmentsDb,
  createRemoteDb,
  isAuthError,
  preWarmIndexes,
  SYNC_OPTIONS,
} from './use_couchdb_sync_helpers';

/** Sets up event handlers for main database sync */
function setupMainSyncHandlers(
  syncHandler: PouchDB.Replication.Sync<object>,
  healthMonitor: ReturnType<typeof usePouchDb>['healthMonitor'],
  handleAuthError: () => void,
) {
  syncHandler.on('error', (error) => {
    console.error('Sync error:', error);
    recordSyncEvent('error', { error: String(error) });
    if (isAuthError(error)) handleAuthError();
    healthMonitor.updateSyncStatus('error');
  });

  syncHandler.on('active', () => {
    recordSyncEvent('active');
    healthMonitor.updateSyncStatus('syncing');
  });

  syncHandler.on('complete', () => {
    recordSyncEvent('complete');
    healthMonitor.updateSyncStatus('connected');
  });
}

export const useCouchDbSync = () => {
  const { sync, healthMonitor, rawDb, attachmentsDb } = usePouchDb();
  const { authToken, logout } = useAuth();

  const handleAuthError = useCallback(() => {
    console.warn('Sync authentication failed - token may be expired');
    healthMonitor.updateSyncStatus('error');
    logout();
  }, [healthMonitor, logout]);

  // Main database sync
  useEffect(() => {
    if (!authToken) return;

    let isCancelled = false;
    const remoteDb = createRemoteDb(authToken.token);
    const syncHandler = sync(remoteDb, SYNC_OPTIONS);

    setupMainSyncHandlers(syncHandler, healthMonitor, handleAuthError);

    syncHandler.on('paused', async () => {
      recordSyncEvent('paused');
      healthMonitor.updateSyncStatus('connected');
      await preWarmIndexes(rawDb, () => isCancelled);
    });

    recordSyncEvent('started');
    healthMonitor.updateSyncStatus('syncing');

    return () => {
      isCancelled = true;
      syncHandler.cancel();
      remoteDb.close();
      recordSyncEvent('cancelled');
      healthMonitor.updateSyncStatus('disconnected');
    };
  }, [sync, authToken, handleAuthError, healthMonitor, rawDb]);

  // Attachments database sync (separate effect to keep concerns isolated)
  useEffect(() => {
    if (!authToken) return;

    const remoteAttachmentsDb = createRemoteAttachmentsDb(authToken.token);
    const attachmentsSyncHandler = attachmentsDb.sync(remoteAttachmentsDb, SYNC_OPTIONS);

    attachmentsSyncHandler.on('error', (error) => {
      console.error('Attachments sync error:', error);
      if (isAuthError(error)) handleAuthError();
    });

    return () => {
      attachmentsSyncHandler.cancel();
      remoteAttachmentsDb.close();
    };
  }, [attachmentsDb, authToken, handleAuthError]);
};
