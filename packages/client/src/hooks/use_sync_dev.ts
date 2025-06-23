import PouchDB from 'pouchdb-browser';
import { useEffect } from 'react';

import { usePouchDb } from '../pouch_db';

export const useSyncDev = () => {
  const { sync } = usePouchDb();

  useEffect(() => {
    // Development only - no auth needed
    const remoteDb = new PouchDB(
      'http://admin:password@localhost:5984/todos-dev',
    );

    const syncHandler = sync(remoteDb, {
      live: true,
      retry: true,
    });

    return () => syncHandler.cancel();
  }, [sync]);
};
