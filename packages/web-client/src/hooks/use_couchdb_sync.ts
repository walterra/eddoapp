import PouchDB from 'pouchdb-browser';
import { useCallback, useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useAuth } from './use_auth';

export const useCouchDbSync = () => {
  const { sync, healthMonitor } = usePouchDb();
  const { authToken, logout } = useAuth();

  const handleAuthError = useCallback(() => {
    console.warn('Sync authentication failed - token may be expired');
    healthMonitor.updateSyncStatus('error');
    logout();
  }, [healthMonitor, logout]);

  useEffect(() => {
    // Only sync when authenticated
    if (!authToken) return;

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

    syncHandler.on('paused', () => {
      healthMonitor.updateSyncStatus('connected');
    });

    // Initial status
    healthMonitor.updateSyncStatus('syncing');

    return () => {
      syncHandler.cancel();
      healthMonitor.updateSyncStatus('disconnected');
    };
  }, [sync, authToken, handleAuthError, healthMonitor]);
};
