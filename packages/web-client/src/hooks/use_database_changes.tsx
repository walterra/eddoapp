/**
 * Database changes provider - single PouchDB listener for the entire app
 * Skips invalidation for local changes that were already handled by mutations
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
import { recentMutations } from './use_todo_mutations';

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
  const pendingChangesRef = useRef<Set<string>>(new Set());

  // Debounced invalidation to batch rapid changes
  const scheduleInvalidation = useCallback(
    (docId: string) => {
      // Skip if this change was from a local mutation
      if (recentMutations.has(docId)) {
        recentMutations.delete(docId);
        return;
      }

      pendingChangesRef.current.add(docId);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (pendingChangesRef.current.size > 0) {
          console.time('invalidateQueries');
          queryClient.invalidateQueries({ queryKey: ['todos'] });
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          console.timeEnd('invalidateQueries');
          pendingChangesRef.current.clear();
        }
        debounceTimerRef.current = null;
      }, INVALIDATION_DEBOUNCE_MS);
    },
    [queryClient],
  );

  useEffect(() => {
    const changesListener = changes({
      live: true,
      since: 'now',
      include_docs: false,
    });

    changesListener.on('change', (change) => {
      setChangeCount(Number(change.seq));
      // Skip invalidation for local mutations
      scheduleInvalidation(change.id);
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
  }, [changes, scheduleInvalidation]);

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
