import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Activity, Todo } from '@eddo/core-shared';
import { getRepeatTodo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';

/**
 * Track recently mutated document IDs to skip redundant invalidations.
 * The changes listener checks this to avoid re-fetching data we just updated.
 */
export const recentMutations = new Set<string>();

interface UpdateTodoContext {
  previousTodos: Map<string, Todo[] | undefined>;
  previousActivities: Map<string, Activity[] | undefined>;
  previousTimeTracking: string[] | undefined;
}

/**
 * Mutation hook for updating todos with optimistic updates.
 * Updates the cache immediately, then persists to database.
 * Rolls back on error.
 */
export function useTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, Todo, UpdateTodoContext>({
    mutationFn: async (updatedTodo: Todo) => {
      // Get latest _rev to avoid conflict errors
      const current = await safeDb.safeGet<Todo>(updatedTodo._id);
      const todoToSave = current ? { ...updatedTodo, _rev: current._rev } : updatedTodo;
      const result = await safeDb.safePut(todoToSave);
      return result;
    },

    onMutate: async (updatedTodo) => {
      // Track this mutation to skip redundant invalidation from changes listener
      recentMutations.add(updatedTodo._id);

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });

      // Snapshot current cache state for rollback
      const previousTodos = new Map<string, Todo[] | undefined>();
      const previousActivities = new Map<string, Activity[] | undefined>();

      // Get all cached todo queries
      const todoQueries = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] });
      for (const [queryKey, data] of todoQueries) {
        previousTodos.set(JSON.stringify(queryKey), data);
      }

      // Get all cached activity queries
      const activityQueries = queryClient.getQueriesData<Activity[]>({
        queryKey: ['activities', 'byActive'],
      });
      for (const [queryKey, data] of activityQueries) {
        previousActivities.set(JSON.stringify(queryKey), data);
      }

      // Get time tracking state
      const previousTimeTracking = queryClient.getQueryData<string[]>([
        'todos',
        'byTimeTrackingActive',
      ]);

      // Optimistically update todos cache
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] }, (old) => {
        if (!old) return old;

        // Check if todo exists in this query's date range
        const existingIdx = old.findIndex((t) => t._id === updatedTodo._id);

        if (existingIdx >= 0) {
          // Update existing todo
          const updated = [...old];
          updated[existingIdx] = updatedTodo;
          return updated;
        }

        // Todo might need to be added to this query (due date changed)
        // For now, just return old - the refetch will handle it
        return old;
      });

      // Optimistically update activities cache
      queryClient.setQueriesData<Activity[]>({ queryKey: ['activities', 'byActive'] }, (old) => {
        if (!old) return old;
        return old.map((activity) => {
          if (activity.id === updatedTodo._id) {
            return { ...activity, doc: updatedTodo };
          }
          return activity;
        });
      });

      // Optimistically update time tracking active
      queryClient.setQueryData<string[]>(['todos', 'byTimeTrackingActive'], (old) => {
        if (!old) return old;

        const isNowActive =
          updatedTodo.active && Object.values(updatedTodo.active).some((v) => v === null);
        const wasActive = old.includes(updatedTodo._id);

        if (isNowActive && !wasActive) {
          return [...old, updatedTodo._id];
        } else if (!isNowActive && wasActive) {
          return old.filter((id) => id !== updatedTodo._id);
        }
        return old;
      });

      return { previousTodos, previousActivities, previousTimeTracking };
    },

    onError: (_err, _updatedTodo, context) => {
      // Rollback to previous state on error
      if (context) {
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
    },

    // Don't invalidate on settled - optimistic update is sufficient
    // The changes listener will handle sync from other sources
  });
}

/**
 * Mutation hook for toggling todo completion with optimistic updates.
 */
export function useToggleCompletionMutation() {
  const { safeDb } = usePouchDb();
  const todoMutation = useTodoMutation();

  return useMutation<Todo, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      const updatedTodo = {
        ...todo,
        completed: todo.completed === null ? new Date().toISOString() : null,
      };

      const result = await todoMutation.mutateAsync(updatedTodo);

      // Handle repeat todos
      if (typeof updatedTodo.repeat === 'number' && updatedTodo.completed) {
        await safeDb.safePut(getRepeatTodo(updatedTodo));
      }

      return result;
    },
  });
}

/**
 * Mutation hook for toggling time tracking with optimistic updates.
 */
export function useToggleTimeTrackingMutation() {
  const todoMutation = useTodoMutation();

  return useMutation<Todo, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      const updatedActive = { ...todo.active };

      if (
        Object.keys(updatedActive).length === 0 ||
        Object.values(updatedActive).every((d) => d !== null)
      ) {
        // Start tracking
        updatedActive[new Date().toISOString()] = null;
      } else {
        // Stop tracking
        const activeEntry = Object.entries(updatedActive).find((d) => d[1] === null);
        if (activeEntry) {
          updatedActive[activeEntry[0]] = new Date().toISOString();
        }
      }

      const updatedTodo = { ...todo, active: updatedActive };
      return todoMutation.mutateAsync(updatedTodo);
    },
  });
}
