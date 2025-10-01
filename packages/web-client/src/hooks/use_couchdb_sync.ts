import PouchDB from 'pouchdb-browser';
import { useCallback, useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useAuth } from './use_auth';

export const useCouchDbSync = () => {
  const { sync, healthMonitor, rawDb } = usePouchDb();
  const { authToken, logout } = useAuth();

  const handleAuthError = useCallback(() => {
    console.warn('Sync authentication failed - token may be expired');
    healthMonitor.updateSyncStatus('error');
    logout();
  }, [healthMonitor, logout]);

  useEffect(() => {
    // Only sync when authenticated
    if (!authToken) return;

    let isCancelled = false;

    // Connect to API server with authentication (hardcoded relative path)
    const remoteDb = new PouchDB('http://localhost:3000/api/db', {
      fetch: (url, opts) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken.token}`,
        };

        // Add existing headers if they exist
        if (opts?.headers) {
          Object.assign(headers, opts.headers);
        }

        return fetch(url, {
          ...opts,
          headers,
        });
      },
    });

    const syncHandler = sync(remoteDb, {
      live: true,
      retry: true,
      batch_size: 10,
      batches_limit: 1,
      heartbeat: 10000,
      timeout: 5000,
    });

    // Add error handling for authentication failures
    syncHandler.on('error', (error) => {
      console.error('Sync error:', error);
      // Type assertion for error object that may have status
      const errorWithStatus = error as { status?: number };
      if (errorWithStatus.status === 401 || errorWithStatus.status === 403) {
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

      // Pre-warm indexes to avoid query-time rebuilding
      // This fires after each sync cycle completes in live sync mode
      try {
        if (isCancelled) return;
        await rawDb.find({
          selector: { version: 'alpha3' },
          limit: 0,
        });
        if (!isCancelled) {
          console.log('✅ Indexes pre-warmed after sync');
        }
      } catch (err) {
        // Don't fail sync if pre-warming fails
        if (!isCancelled) {
          console.warn('⚠️  Index pre-warming failed:', err);
        }
      }
    });

    // Initial status
    healthMonitor.updateSyncStatus('syncing');

    return () => {
      isCancelled = true;
      syncHandler.cancel();
      remoteDb.close();
      healthMonitor.updateSyncStatus('disconnected');
    };
  }, [sync, authToken, handleAuthError, healthMonitor, rawDb]);
};
