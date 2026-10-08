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
  useMemo,
  useRef,
  useState,
} from 'react';

import { exposeBenchmarkQueryStatus } from '../config/benchmark_query_status';
import { exposeBenchmarkSyncStatus, recordBenchmarkChange } from '../config/benchmark_sync_status';
import { usePouchDb } from '../pouch_db';
import { isReplicationActive, subscribeToReplicationActivity } from './replication_activity';
import { recentMutations } from './use_recent_mutations';

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

interface InvalidationSchedulerConfig {
  queryClient: QueryClient;
  refs: DebounceRefs;
  onFlush: (changeCount: number) => void;
}

export interface InvalidationScheduler {
  flush: () => void;
  hold: () => void;
  schedule: (docId: string) => void;
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

/** Create replication-aware invalidation scheduler. */
export function createInvalidationScheduler(
  config: InvalidationSchedulerConfig,
): InvalidationScheduler {
  const { queryClient, refs, onFlush } = config;
  const flush = (): void => {
    const changeCount = refs.pending.current.size;
    invalidateQueries(queryClient, refs.pending.current);
    if (changeCount > 0) onFlush(changeCount);
    refs.timer.current = null;
  };
  const hold = (): void => {
    if (refs.timer.current) clearTimeout(refs.timer.current);
    refs.timer.current = null;
  };
  const schedule = (docId: string): void => {
    if (recentMutations.has(docId)) {
      recentMutations.delete(docId);
      return;
    }
    refs.pending.current.add(docId);
    if (refs.timer.current) clearTimeout(refs.timer.current);
    refs.timer.current = null;
    if (isReplicationActive()) return;
    refs.timer.current = setTimeout(flush, INVALIDATION_DEBOUNCE_MS);
  };
  return { flush, hold, schedule };
}

interface ChangesListenerConfig {
  changes: ReturnType<typeof usePouchDb>['changes'];
  scheduleInvalidation: (docId: string) => void;
  setIsListening: (listening: boolean) => void;
  debounceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/** Hook to manage PouchDB changes listener lifecycle */
function useChangesListener(config: ChangesListenerConfig) {
  const { changes, scheduleInvalidation, setIsListening, debounceTimerRef } = config;
  useEffect(() => {
    const listener = changes({ live: true, since: 'now', include_docs: false });
    listener.on('change', (change) => {
      recordBenchmarkChange(change.id, change.changes[0]?.rev ?? '');
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
  }, [changes, scheduleInvalidation, setIsListening, debounceTimerRef]);
}

export const DatabaseChangesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { changes, safeDb } = usePouchDb();
  useEffect(() => exposeBenchmarkSyncStatus(safeDb), [safeDb]);
  const queryClient = useQueryClient();
  useEffect(() => exposeBenchmarkQueryStatus(queryClient), [queryClient]);
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangesRef = useRef<Set<string>>(new Set());

  const scheduler = useMemo(
    () =>
      createInvalidationScheduler({
        queryClient,
        refs: { timer: debounceTimerRef, pending: pendingChangesRef },
        onFlush: (count) => setChangeCount((current) => current + count),
      }),
    [queryClient],
  );
  const scheduleInvalidation = useCallback(scheduler.schedule, [scheduler]);
  useEffect(
    () =>
      subscribeToReplicationActivity((active) => (active ? scheduler.hold() : scheduler.flush())),
    [scheduler],
  );

  useChangesListener({
    changes,
    scheduleInvalidation,
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
