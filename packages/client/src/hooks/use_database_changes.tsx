/**
 * Database changes provider - single PouchDB listener for the entire app
 */
import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';

import { usePouchDb } from '../pouch_db';

interface DatabaseChangesContextType {
  /** Increments whenever database changes occur */
  changeCount: number;
  /** Whether the changes listener is active */
  isListening: boolean;
}

const DatabaseChangesContext = createContext<DatabaseChangesContextType | null>(null);

export const DatabaseChangesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { changes } = usePouchDb();
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const changesListener = changes({
      live: true,
      since: 'now',
      include_docs: true,
    });

    changesListener.on('change', () => {
      setChangeCount(prev => prev + 1);
    });

    changesListener.on('complete', () => {
      setIsListening(false);
    });

    changesListener.on('error', (err) => {
      console.error('Database changes listener error:', err);
      setIsListening(false);
    });

    setIsListening(true);

    return () => {
      changesListener.cancel();
      setIsListening(false);
    };
  }, [changes]);

  return (
    <DatabaseChangesContext.Provider value={{ changeCount, isListening }}>
      {children}
    </DatabaseChangesContext.Provider>
  );
};

/**
 * Hook to subscribe to database changes
 * Returns a number that increments whenever the database changes
 */
export const useDatabaseChanges = (): DatabaseChangesContextType => {
  const context = useContext(DatabaseChangesContext);
  if (!context) {
    throw new Error('useDatabaseChanges must be used within a DatabaseChangesProvider');
  }
  return context;
};