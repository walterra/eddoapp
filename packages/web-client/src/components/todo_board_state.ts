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
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import type { ActivityItem } from './todo_board_helpers';

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

/**
 * Hook for fetching and processing todo data
 */
export function useTodoBoardData({
  startDate,
  endDate,
  isInitialized,
}: {
  startDate: Date;
  endDate: Date;
  isInitialized: boolean;
}) {
  const todosQuery = useTodosByWeek({ startDate, endDate, enabled: isInitialized });
  const activitiesQuery = useActivitiesByWeek({ startDate, endDate, enabled: isInitialized });
  const timeTrackingQuery = useTimeTrackingActive({ enabled: isInitialized });

  const activities = useMemo(
    () => (activitiesQuery.data ?? []) as ActivityItem[],
    [activitiesQuery.data],
  );

  const timeTrackingActive = useMemo(
    () => timeTrackingQuery.data ?? ['hide-by-default'],
    [timeTrackingQuery.data],
  );

  const todos = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  const outdatedTodosMemo = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => !isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  const isLoading = todosQuery.isLoading || activitiesQuery.isLoading;
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
