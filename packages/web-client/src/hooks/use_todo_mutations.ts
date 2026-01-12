import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Activity, NewTodo, Todo } from '@eddo/core-shared';
import { getRepeatTodo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';
import { recentMutations } from './use_recent_mutations';
import {
  rollbackCache,
  snapshotCacheState,
  updateActivitiesCache,
  updateTimeTrackingCache,
  updateTodosCache,
  type UpdateTodoContext,
} from './use_todo_mutations_helpers';

// Re-export for backward compatibility
export { recentMutations } from './use_recent_mutations';

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
      recentMutations.add(updatedTodo._id);

      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });

      const context = snapshotCacheState(queryClient);

      updateTodosCache(queryClient, updatedTodo);
      updateActivitiesCache(queryClient, updatedTodo);
      updateTimeTrackingCache(queryClient, updatedTodo);

      return context;
    },

    onError: (_err, _updatedTodo, context) => {
      if (context) {
        rollbackCache(queryClient, context);
      }
    },

    // Don't invalidate on settled - optimistic update is sufficient
    // The changes listener will handle sync from other sources
  });
}

/**
 * Mutation hook for creating a new todo.
 * @returns Mutation with isPending, isError, error states
 */
export function useCreateTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, NewTodo>({
    mutationFn: async (newTodo: NewTodo) => {
      const result = await safeDb.safePut(newTodo);
      return result;
    },
    onSuccess: (savedTodo) => {
      // Track mutation to skip redundant invalidation from changes listener
      recentMutations.add(savedTodo._id);

      // Invalidate todos queries to refetch with new todo
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

/**
 * Mutation hook for deleting a todo.
 * @returns Mutation with isPending, isError, error states
 */
export function useDeleteTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      await safeDb.safeRemove(todo);
    },
    onMutate: async (todo) => {
      // Track mutation to skip redundant invalidation
      recentMutations.add(todo._id);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });

      // Optimistically remove from todos cache
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] }, (old) => {
        if (!old) return old;
        return old.filter((t) => t._id !== todo._id);
      });

      // Optimistically remove from activities cache
      queryClient.setQueriesData<Activity[]>({ queryKey: ['activities', 'byActive'] }, (old) => {
        if (!old) return old;
        return old.filter((a) => a.id !== todo._id);
      });

      // Optimistically remove from time tracking
      queryClient.setQueryData<string[]>(['todos', 'byTimeTrackingActive'], (old) => {
        if (!old) return old;
        return old.filter((id) => id !== todo._id);
      });
    },
    onError: () => {
      // Refetch on error to restore correct state
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

/**
 * Mutation hook for saving/updating a todo with repeat handling.
 * Does NOT use optimistic updates - invalidates queries after save instead.
 * This ensures correct behavior when due date or other filter-affecting fields change.
 * @returns Mutation with isPending, isError, error states
 */
export function useSaveTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, { todo: Todo; originalTodo: Todo }>({
    mutationFn: async ({ todo, originalTodo }) => {
      // Get latest _rev to avoid conflict errors
      const current = await safeDb.safeGet<Todo>(todo._id);
      const todoToSave = current ? { ...todo, _rev: current._rev } : todo;
      const result = await safeDb.safePut(todoToSave);

      // Handle repeat todos when completion state changes
      if (
        typeof todo.repeat === 'number' &&
        todo.completed &&
        originalTodo.completed !== todo.completed
      ) {
        await safeDb.safePut(getRepeatTodo(todo));
      }

      return result;
    },
    onSuccess: (savedTodo) => {
      // Track mutation to skip redundant invalidation from changes listener
      recentMutations.add(savedTodo._id);

      // Invalidate all todo queries to ensure consistent state
      // This handles due date changes, context changes, and any other field updates
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
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
