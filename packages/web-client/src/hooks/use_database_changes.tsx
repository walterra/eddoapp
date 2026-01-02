/**
 * Database changes provider - single PouchDB listener for the entire app
 * Skips invalidation for local changes that were already handled by mutations
 */
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
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
  changeCount: number;
  isListening: boolean;
}

const DatabaseChangesContext = createContext<DatabaseChangesContextType | null>(null);

interface DebounceRefs {
  timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pending: React.MutableRefObject<Set<string>>;
}

/** Invalidate todo and activity queries */
function invalidateQueries(queryClient: QueryClient, pending: Set<string>): void {
  if (pending.size === 0) return;
  console.time('invalidateQueries');
  queryClient.invalidateQueries({ queryKey: ['todos'] });
  queryClient.invalidateQueries({ queryKey: ['activities'] });
  console.timeEnd('invalidateQueries');
  pending.clear();
}

/** Create debounced invalidation handler */
function createInvalidationScheduler(queryClient: QueryClient, refs: DebounceRefs) {
  return (docId: string) => {
    if (recentMutations.has(docId)) {
      recentMutations.delete(docId);
      return;
    }
    refs.pending.current.add(docId);
    if (refs.timer.current) clearTimeout(refs.timer.current);
    refs.timer.current = setTimeout(() => {
      invalidateQueries(queryClient, refs.pending.current);
      refs.timer.current = null;
    }, INVALIDATION_DEBOUNCE_MS);
  };
}

interface ChangesListenerConfig {
  changes: ReturnType<typeof usePouchDb>['changes'];
  scheduleInvalidation: (docId: string) => void;
  setChangeCount: (count: number) => void;
  setIsListening: (listening: boolean) => void;
  debounceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/** Hook to manage PouchDB changes listener lifecycle */
function useChangesListener(config: ChangesListenerConfig) {
  const { changes, scheduleInvalidation, setChangeCount, setIsListening, debounceTimerRef } =
    config;
  useEffect(() => {
    const listener = changes({ live: true, since: 'now', include_docs: false });
    listener.on('change', (change) => {
      setChangeCount(Number(change.seq));
      scheduleInvalidation(change.id);
    });
    listener.on('complete', () => setIsListening(false));
    listener.on('error', (err) => {
      console.error('Database changes listener error:', err);
      setIsListening(false);
    });
    setIsListening(true);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      listener.cancel();
      setIsListening(false);
    };
  }, [changes, scheduleInvalidation, setChangeCount, setIsListening, debounceTimerRef]);
}

export const DatabaseChangesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { changes } = usePouchDb();
  const queryClient = useQueryClient();
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangesRef = useRef<Set<string>>(new Set());

  const refs: DebounceRefs = { timer: debounceTimerRef, pending: pendingChangesRef };
  const scheduleInvalidation = useCallback(createInvalidationScheduler(queryClient, refs), [
    queryClient,
  ]);

  useChangesListener({
    changes,
    scheduleInvalidation,
    setChangeCount,
    setIsListening,
    debounceTimerRef,
  });

  return (
    <DatabaseChangesContext.Provider value={{ changeCount, isListening }}>
      {children}
    </DatabaseChangesContext.Provider>
  );
};

/** Hook to subscribe to database changes */
export const useDatabaseChanges = (): DatabaseChangesContextType => {
  const context = useContext(DatabaseChangesContext);
  if (!context) {
    throw new Error('useDatabaseChanges must be used within a DatabaseChangesProvider');
  }
  return context;
};
