/**
 * Helper functions for todo mutations hook
 */
import type { QueryClient } from '@tanstack/react-query';

import type { Activity, Todo } from '@eddo/core-shared';

export interface UpdateTodoContext {
  previousTodos: Map<string, Todo[] | undefined>;
  previousActivities: Map<string, Activity[] | undefined>;
  previousTimeTracking: string[] | undefined;
}

/** Snapshot current cache state for rollback */
export function snapshotCacheState(queryClient: QueryClient): UpdateTodoContext {
  const previousTodos = new Map<string, Todo[] | undefined>();
  const previousActivities = new Map<string, Activity[] | undefined>();

  const todoQueries = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] });
  for (const [queryKey, data] of todoQueries) {
    previousTodos.set(JSON.stringify(queryKey), data);
  }

  const activityQueries = queryClient.getQueriesData<Activity[]>({
    queryKey: ['activities', 'byActive'],
  });
  for (const [queryKey, data] of activityQueries) {
    previousActivities.set(JSON.stringify(queryKey), data);
  }

  const previousTimeTracking = queryClient.getQueryData<string[]>([
    'todos',
    'byTimeTrackingActive',
  ]);

  return { previousTodos, previousActivities, previousTimeTracking };
}

/** Optimistically update todos cache */
export function updateTodosCache(queryClient: QueryClient, updatedTodo: Todo): void {
  queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] }, (old) => {
    if (!old) return old;
    const existingIdx = old.findIndex((t) => t._id === updatedTodo._id);
    if (existingIdx >= 0) {
      const updated = [...old];
      updated[existingIdx] = updatedTodo;
      return updated;
    }
    return old;
  });
}

/** Optimistically update activities cache */
export function updateActivitiesCache(queryClient: QueryClient, updatedTodo: Todo): void {
  queryClient.setQueriesData<Activity[]>({ queryKey: ['activities', 'byActive'] }, (old) => {
    if (!old) return old;
    return old.map((activity) => {
      if (activity.id === updatedTodo._id) {
        return { ...activity, doc: updatedTodo };
      }
      return activity;
    });
  });
}

/** Check if todo is currently time tracking */
function isTodoTimeTrackingActive(todo: Todo): boolean {
  return !!(todo.active && Object.values(todo.active).some((v) => v === null));
}

/** Optimistically update time tracking cache */
export function updateTimeTrackingCache(queryClient: QueryClient, updatedTodo: Todo): void {
  queryClient.setQueryData<string[]>(['todos', 'byTimeTrackingActive'], (old) => {
    if (!old) return old;

    const isNowActive = isTodoTimeTrackingActive(updatedTodo);
    const wasActive = old.includes(updatedTodo._id);

    if (isNowActive && !wasActive) {
      return [...old, updatedTodo._id];
    } else if (!isNowActive && wasActive) {
      return old.filter((id) => id !== updatedTodo._id);
    }
    return old;
  });
}

/** Rollback cache to previous state */
export function rollbackCache(queryClient: QueryClient, context: UpdateTodoContext): void {
  for (const [key, data] of context.previousTodos) {
    const queryKey = JSON.parse(key);
    queryClient.setQueryData(queryKey, data);
  }
  for (const [key, data] of context.previousActivities) {
    const queryKey = JSON.parse(key);
    queryClient.setQueryData(queryKey, data);
  }
  if (context.previousTimeTracking) {
    queryClient.setQueryData(['todos', 'byTimeTrackingActive'], context.previousTimeTracking);
  }
}
