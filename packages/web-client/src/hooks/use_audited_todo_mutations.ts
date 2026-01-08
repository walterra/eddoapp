/**
 * Audited todo mutations - wraps standard mutations with audit logging.
 * Use these instead of the base mutations to automatically log all changes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Activity, NewTodo, Todo } from '@eddo/core-shared';
import { getRepeatTodo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';
import { useAuditLog, type AuditAction } from './use_audit_log';
import {
  rollbackCache,
  snapshotCacheState,
  updateActivitiesCache,
  updateTimeTrackingCache,
  updateTodosCache,
  type UpdateTodoContext,
} from './use_todo_mutations_helpers';

/** Track recently mutated document IDs to skip redundant invalidations */
export const recentMutations = new Set<string>();

/**
 * Audited mutation hook for updating todos with optimistic updates.
 * Logs 'update' action after successful save.
 */
export function useAuditedTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();
  const { logAudit } = useAuditLog();

  return useMutation<Todo, Error, { todo: Todo; originalTodo: Todo }, UpdateTodoContext>({
    mutationFn: async ({ todo }) => {
      const current = await safeDb.safeGet<Todo>(todo._id);
      const todoToSave = current ? { ...todo, _rev: current._rev } : todo;
      return safeDb.safePut(todoToSave);
    },

    onMutate: async ({ todo }) => {
      recentMutations.add(todo._id);
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });

      const context = snapshotCacheState(queryClient);
      updateTodosCache(queryClient, todo);
      updateActivitiesCache(queryClient, todo);
      updateTimeTrackingCache(queryClient, todo);

      return context;
    },

    onError: (_err, _vars, context) => {
      if (context) rollbackCache(queryClient, context);
    },

    onSuccess: async (savedTodo, { originalTodo }) => {
      // Determine the specific action
      let action: AuditAction = 'update';

      // Check for completion change
      if (originalTodo.completed === null && savedTodo.completed !== null) {
        action = 'complete';
      } else if (originalTodo.completed !== null && savedTodo.completed === null) {
        action = 'uncomplete';
      }

      await logAudit({
        action,
        entityId: savedTodo._id,
        before: originalTodo,
        after: savedTodo,
      });
    },
  });
}

/**
 * Audited mutation hook for creating a new todo.
 * Logs 'create' action after successful save.
 */
export function useAuditedCreateTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();
  const { logAudit } = useAuditLog();

  return useMutation<Todo, Error, NewTodo>({
    mutationFn: async (newTodo: NewTodo) => {
      return safeDb.safePut(newTodo);
    },

    onSuccess: async (savedTodo) => {
      recentMutations.add(savedTodo._id);
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      await logAudit({
        action: 'create',
        entityId: savedTodo._id,
        after: savedTodo,
      });
    },
  });
}

/**
 * Audited mutation hook for deleting a todo.
 * Logs 'delete' action after successful deletion.
 */
export function useAuditedDeleteTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();
  const { logAudit } = useAuditLog();

  return useMutation<Todo, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      await safeDb.safeRemove(todo);
      return todo; // Return the deleted todo for audit logging
    },

    onMutate: async (todo) => {
      recentMutations.add(todo._id);
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });

      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'byDueDate'] }, (old) => {
        if (!old) return old;
        return old.filter((t) => t._id !== todo._id);
      });

      queryClient.setQueriesData<Activity[]>({ queryKey: ['activities', 'byActive'] }, (old) => {
        if (!old) return old;
        return old.filter((a) => a.id !== todo._id);
      });

      queryClient.setQueryData<string[]>(['todos', 'byTimeTrackingActive'], (old) => {
        if (!old) return old;
        return old.filter((id) => id !== todo._id);
      });
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },

    onSuccess: async (deletedTodo) => {
      await logAudit({
        action: 'delete',
        entityId: deletedTodo._id,
        before: deletedTodo,
      });
    },
  });
}

/**
 * Audited mutation hook for saving/updating a todo with repeat handling.
 * Logs appropriate action after successful save.
 */
export function useAuditedSaveTodoMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();
  const { logAudit } = useAuditLog();

  return useMutation<Todo, Error, { todo: Todo; originalTodo: Todo }>({
    mutationFn: async ({ todo, originalTodo }) => {
      const current = await safeDb.safeGet<Todo>(todo._id);
      const todoToSave = current ? { ...todo, _rev: current._rev } : todo;
      const result = await safeDb.safePut(todoToSave);

      if (
        typeof todo.repeat === 'number' &&
        todo.completed &&
        originalTodo.completed !== todo.completed
      ) {
        await safeDb.safePut(getRepeatTodo(todo));
      }

      return result;
    },

    onSuccess: async (savedTodo, { originalTodo }) => {
      recentMutations.add(savedTodo._id);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });

      // Determine action type
      let action: AuditAction = 'update';
      if (originalTodo.completed === null && savedTodo.completed !== null) {
        action = 'complete';
      } else if (originalTodo.completed !== null && savedTodo.completed === null) {
        action = 'uncomplete';
      }

      await logAudit({
        action,
        entityId: savedTodo._id,
        before: originalTodo,
        after: savedTodo,
      });
    },
  });
}

/**
 * Audited mutation hook for toggling todo completion.
 * Logs 'complete' or 'uncomplete' action.
 */
export function useAuditedToggleCompletionMutation() {
  const { safeDb } = usePouchDb();
  const auditedMutation = useAuditedTodoMutation();

  return useMutation<Todo, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      const updatedTodo = {
        ...todo,
        completed: todo.completed === null ? new Date().toISOString() : null,
      };

      const result = await auditedMutation.mutateAsync({
        todo: updatedTodo,
        originalTodo: todo,
      });

      if (typeof updatedTodo.repeat === 'number' && updatedTodo.completed) {
        await safeDb.safePut(getRepeatTodo(updatedTodo));
      }

      return result;
    },
  });
}

/**
 * Audited mutation hook for toggling time tracking.
 * Logs 'time_tracking_start' or 'time_tracking_stop' action.
 */
export function useAuditedToggleTimeTrackingMutation() {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();
  const { logAudit } = useAuditLog();

  return useMutation<Todo, Error, Todo>({
    mutationFn: async (todo: Todo) => {
      const updatedActive = { ...todo.active };
      let action: AuditAction;

      if (
        Object.keys(updatedActive).length === 0 ||
        Object.values(updatedActive).every((d) => d !== null)
      ) {
        // Start tracking
        updatedActive[new Date().toISOString()] = null;
        action = 'time_tracking_start';
      } else {
        // Stop tracking
        const activeEntry = Object.entries(updatedActive).find((d) => d[1] === null);
        if (activeEntry) {
          updatedActive[activeEntry[0]] = new Date().toISOString();
        }
        action = 'time_tracking_stop';
      }

      const updatedTodo = { ...todo, active: updatedActive };

      // Get latest _rev
      const current = await safeDb.safeGet<Todo>(todo._id);
      const todoToSave = current ? { ...updatedTodo, _rev: current._rev } : updatedTodo;
      const result = await safeDb.safePut(todoToSave);

      // Log audit with the action we determined
      await logAudit({
        action,
        entityId: result._id,
        before: todo,
        after: result,
      });

      return result;
    },

    onMutate: async (todo) => {
      recentMutations.add(todo._id);
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      await queryClient.cancelQueries({ queryKey: ['activities'] });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
