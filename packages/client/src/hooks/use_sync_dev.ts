import PouchDB from 'pouchdb-browser';
import { useEffect } from 'react';

import { getCouchDbUrl, validateEnv } from '@eddo/shared';
import { usePouchDb } from '../pouch_db';

export const useSyncDev = () => {
  const { sync } = usePouchDb();

  useEffect(() => {
    // Development only - no auth needed
    const env = validateEnv(process.env);
    const remoteDb = new PouchDB(getCouchDbUrl(env));

    const syncHandler = sync(remoteDb, {
      live: true,
      retry: true,
    });

    return () => syncHandler.cancel();
  }, [sync]);
};
