/**
 * Mutation hook for bulk updating multiple todos
 */
import type { Todo } from '@eddo/core-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { usePouchDb } from '../pouch_db';
import { recentMutations } from './use_recent_mutations';
import {
  rollbackCache,
  snapshotCacheState,
  updateTodosCache,
  type UpdateTodoContext,
} from './use_todo_mutations_helpers';

interface BulkUpdateResult {
  updated: Todo[];
  failed: Array<{ id: string; error: Error }>;
}

/**
 * Mutation hook for updating multiple todos at once.
 * Uses optimistic updates and rolls back on error.
 */
export function useBulkTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  return useMutation<BulkUpdateResult, Error, Todo[], UpdateTodoContext>({
    mutationFn: async (todos: Todo[]) => {
      const updated: Todo[] = [];
      const failed: Array<{ id: string; error: Error }> = [];

      // Update todos sequentially to avoid conflicts
      for (const todo of todos) {
        try {
          const current = await safeDb.safeGet<Todo>(todo._id);
          const todoToSave = current ? { ...todo, _rev: current._rev } : todo;
          const result = await safeDb.safePut(todoToSave);
          updated.push(result);
        } catch (error) {
          failed.push({ id: todo._id, error: error as Error });
        }
      }

      return { updated, failed };
    },

    onMutate: async (todos) => {
      // Track all mutations
      for (const todo of todos) {
        recentMutations.add(todo._id);
      }

      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const context = snapshotCacheState(queryClient);

      // Optimistically update all todos
      for (const todo of todos) {
        updateTodosCache(queryClient, todo);
      }

      return context;
    },

    onError: (_err, _todos, context) => {
      if (context) {
        rollbackCache(queryClient, context);
      }
    },

    onSuccess: () => {
      // Invalidate to ensure consistency after bulk update
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
