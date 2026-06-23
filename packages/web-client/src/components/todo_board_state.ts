/**
 * State management helpers for TodoBoard component
 */
import { type DatabaseError, type Todo, isLatestVersion } from '@eddo/core-client';
import { useEffect, useMemo, useState } from 'react';

import type { SafeDbOperations } from '../api/safe-db-operations';
import { ensureDesignDocuments } from '../database_setup';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useDelayedLoading } from '../hooks/use_delayed_loading';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByDateRange } from '../hooks/use_todos_by_date_range';
import { usePouchDb } from '../pouch_db';
import type { ActivityItem } from './todo_board_helpers';
import { migrateLocalTodosInBackground, migrateVisibleLegacyTodos } from './todo_migration';

/**
 * Hook for managing database initialization state
 */
export function useDbInitialization(safeDb: SafeDbOperations, rawDb: PouchDB.Database | undefined) {
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    const initializeDb = async () => {
      setError(null);
      try {
        await ensureDesignDocuments(safeDb, rawDb);
        setIsInitialized(true);
        window.setTimeout(() => {
          migrateLocalTodosInBackground(rawDb).catch((err) => {
            console.error('Error migrating local todos:', err);
          });
        }, 5000);
      } catch (err) {
        console.error('Error initializing design documents:', err);
        setError(err as DatabaseError);
        setIsInitialized(true);
      }
    };

    initializeDb();
  }, [isInitialized, safeDb, rawDb]);

  return { error, setError, isInitialized };
}

/** Runs current-view legacy migration before enabling todo queries. */
function useVisibleTodoMigration(
  startDate: string,
  endDate: string,
  isInitialized: boolean,
): boolean {
  const { rawDb } = usePouchDb();
  const [isMigrated, setIsMigrated] = useState(false);

  useEffect(() => {
    setIsMigrated(false);
    if (!rawDb || !isInitialized) return;

    let cancelled = false;

    const migrateVisibleTodos = async () => {
      try {
        const migratedCount = await migrateVisibleLegacyTodos(rawDb, startDate, endDate);
        if (migratedCount > 0) {
          console.info(`Migrated ${migratedCount} visible todos to latest schema version`);
        }
      } catch (err) {
        console.error('Error migrating visible todos:', err);
      } finally {
        if (!cancelled) setIsMigrated(true);
      }
    };

    migrateVisibleTodos();

    return () => {
      cancelled = true;
    };
  }, [rawDb, isInitialized, startDate, endDate]);

  return isMigrated;
}

/**
 * Hook for fetching and processing todo data
 */
export function useTodoBoardData({
  startDate,
  endDate,
  isInitialized,
}: {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  isInitialized: boolean;
}) {
  const isVisibleMigrationDone = useVisibleTodoMigration(startDate, endDate, isInitialized);
  const isQueryEnabled = isInitialized && isVisibleMigrationDone;
  const todosQuery = useTodosByDateRange({ startDate, endDate, enabled: isQueryEnabled });
  const activitiesQuery = useActivitiesByWeek({ startDate, endDate, enabled: isQueryEnabled });
  const timeTrackingQuery = useTimeTrackingActive({ enabled: isQueryEnabled });

  const activities = useMemo(
    () => (activitiesQuery.data ?? []) as ActivityItem[],
    [activitiesQuery.data],
  );

  const timeTrackingActive = useMemo(
    () => timeTrackingQuery.data ?? ['hide-by-default'],
    [timeTrackingQuery.data],
  );

  const allTodos = useMemo(() => (todosQuery.data ?? []) as Todo[], [todosQuery.data]);

  const todos = useMemo(() => allTodos.filter((d: Todo) => isLatestVersion(d)), [allTodos]);

  const outdatedTodosMemo = useMemo(
    () => allTodos.filter((d: Todo) => !isLatestVersion(d)),
    [allTodos],
  );

  const isLoading = !isVisibleMigrationDone || todosQuery.isLoading || activitiesQuery.isLoading;
  const showLoadingSpinner = useDelayedLoading(isLoading && !todosQuery.data);
  const queryError = todosQuery.error || activitiesQuery.error;

  return {
    todos,
    activities,
    timeTrackingActive,
    outdatedTodosMemo,
    isLoading,
    showLoadingSpinner,
    queryError,
    todosQuery,
    activitiesQuery,
  };
}

/**
 * Track outdated todos state
 */
export function useOutdatedTodos(outdatedTodosMemo: Todo[]) {
  const [outdatedTodos, setOutdatedTodos] = useState<Todo[]>([]);

  useEffect(() => {
    setOutdatedTodos(outdatedTodosMemo);
  }, [outdatedTodosMemo]);

  return outdatedTodos;
}

/**
 * Generate download data URL for todos export
 */
export function generateTodosDownloadUrl(todos: Todo[]): string {
  return 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(todos, null, 2));
}
