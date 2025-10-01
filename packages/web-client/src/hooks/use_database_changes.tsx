/**
 * Database changes provider - single PouchDB listener for the entire app
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  type FC,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { usePouchDb } from '../pouch_db';

interface DatabaseChangesContextType {
  /** Increments whenever database changes occur */
  changeCount: number;
  /** Whether the changes listener is active */
  isListening: boolean;
}

const DatabaseChangesContext = createContext<DatabaseChangesContextType | null>(
  null,
);

export const DatabaseChangesProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { changes } = usePouchDb();
  const queryClient = useQueryClient();
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  console.log('changeCount', changeCount);

  useEffect(() => {
    const changesListener = changes({
      live: true,
      since: 'now',
      include_docs: true,
    });

    changesListener.on('change', (d) => {
      setChangeCount(Number(d.seq));
      // Invalidate all queries when database changes occur
      // This triggers TanStack Query to refetch active queries
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
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
  }, [changes, queryClient]);

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
    throw new Error(
      'useDatabaseChanges must be used within a DatabaseChangesProvider',
    );
  }
  return context;
};
