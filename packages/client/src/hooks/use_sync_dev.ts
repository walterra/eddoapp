import PouchDB from 'pouchdb-browser';
import { useEffect } from 'react';

import { getCouchDbUrl } from '@eddo/shared';
import { usePouchDb } from '../pouch_db';

export const useSyncDev = () => {
  const { sync } = usePouchDb();

  useEffect(() => {
    // Development only - no auth needed
    const remoteDb = new PouchDB(getCouchDbUrl());

    const syncHandler = sync(remoteDb, {
      live: true,
      retry: true,
    });

    return () => syncHandler.cancel();
  }, [sync]);
};
