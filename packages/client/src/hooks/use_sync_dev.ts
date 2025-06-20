import PouchDB from 'pouchdb-browser';
import { useEffect } from 'react';

import { usePouchDb } from '../pouch_db';

export const useSyncDev = () => {
  const db = usePouchDb();

  useEffect(() => {
    // Development only - no auth needed
    const remoteDb = new PouchDB(
      'http://admin:password@localhost:5984/todos-dev',
    );

    const sync = db.sync(remoteDb, {
      live: true,
      retry: true,
    });

    return () => sync.cancel();
  }, [db]);
};
