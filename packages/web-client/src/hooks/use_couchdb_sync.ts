import PouchDB from 'pouchdb-browser';
import { useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useAuth } from './use_auth';

export const useCouchDbSync = () => {
  const { sync } = usePouchDb();
  const { authToken } = useAuth();

  useEffect(() => {
    // Only sync when authenticated
    if (!authToken) return;

    // Connect to API server with authentication (hardcoded relative path)
    const remoteDb = new PouchDB('/api/db', {
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

    return () => syncHandler.cancel();
  }, [sync, authToken]);
};
