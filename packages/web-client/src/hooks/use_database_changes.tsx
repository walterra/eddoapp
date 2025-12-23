/**
 * Database changes provider - single PouchDB listener for the entire app
 * Debounces query invalidation to batch rapid changes
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  type FC,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { usePouchDb } from '../pouch_db';

/** Debounce delay for query invalidation (ms) */
const INVALIDATION_DEBOUNCE_MS = 150;

interface DatabaseChangesContextType {
  /** Increments whenever database changes occur */
  changeCount: number;
  /** Whether the changes listener is active */
  isListening: boolean;
}

const DatabaseChangesContext = createContext<DatabaseChangesContextType | null>(null);

export const DatabaseChangesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { changes } = usePouchDb();
  const queryClient = useQueryClient();
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationRef = useRef(false);

  // Debounced invalidation to batch rapid changes
  const invalidateQueries = useCallback(() => {
    pendingInvalidationRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingInvalidationRef.current) {
        console.time('invalidateQueries');
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        console.timeEnd('invalidateQueries');
        pendingInvalidationRef.current = false;
      }
      debounceTimerRef.current = null;
    }, INVALIDATION_DEBOUNCE_MS);
  }, [queryClient]);

  useEffect(() => {
    const changesListener = changes({
      live: true,
      since: 'now',
      include_docs: true,
    });

    changesListener.on('change', (d) => {
      setChangeCount(Number(d.seq));
      // Debounced invalidation batches rapid changes
      invalidateQueries();
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
      // Clean up debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      changesListener.cancel();
      setIsListening(false);
    };
  }, [changes, invalidateQueries]);

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
