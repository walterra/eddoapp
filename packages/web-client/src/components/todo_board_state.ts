/**
 * State management helpers for TodoBoard component
 */
import { type DatabaseError, type Todo, isLatestVersion } from '@eddo/core-client';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SafeDbOperations } from '../api/safe-db-operations';
import { ensureDesignDocuments } from '../database_setup';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useDelayedLoading } from '../hooks/use_delayed_loading';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import { usePouchDb } from '../pouch_db';
import type { ActivityItem } from './todo_board_helpers';

/**
 * Check if a due date needs normalization (missing time component)
 */
function needsDueDateNormalization(due: string): boolean {
  // Valid ISO format should contain 'T' for time component
  return !due.includes('T');
}

/**
 * Normalize due date to full ISO format
 */
function normalizeDueDate(due: string): string {
  if (due.includes('T')) return due;
  return `${due}T23:59:59.999Z`;
}

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
 * Hook to auto-migrate todos with invalid due dates
 */
function useDueDateMigration(todos: Todo[]): void {
  const { rawDb } = usePouchDb();
  const migratedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rawDb || todos.length === 0) return;

    const todosNeedingMigration = todos.filter(
      (todo) => needsDueDateNormalization(todo.due) && !migratedIds.current.has(todo._id),
    );

    if (todosNeedingMigration.length === 0) return;

    const migrateTodos = async () => {
      for (const todo of todosNeedingMigration) {
        try {
          const normalizedDue = normalizeDueDate(todo.due);
          await rawDb.put({ ...todo, due: normalizedDue });
          migratedIds.current.add(todo._id);
          console.log(`Migrated due date for todo ${todo._id}: ${todo.due} -> ${normalizedDue}`);
        } catch (err) {
          console.error(`Failed to migrate due date for todo ${todo._id}:`, err);
        }
      }
    };

    migrateTodos();
  }, [todos, rawDb]);
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

  const allTodos = useMemo(() => (todosQuery.data ?? []) as Todo[], [todosQuery.data]);

  // Auto-migrate todos with invalid due dates
  useDueDateMigration(allTodos);

  const todos = useMemo(() => allTodos.filter((d: Todo) => isLatestVersion(d)), [allTodos]);

  const outdatedTodosMemo = useMemo(
    () => allTodos.filter((d: Todo) => !isLatestVersion(d)),
    [allTodos],
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
