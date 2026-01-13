/**
 * Hooks for parent-child todo relationships
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Todo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';

/** Subtask count info for a parent todo */
export interface SubtaskCount {
  total: number;
  completed: number;
}

/**
 * Fetches children (subtasks) of a todo by parentId
 * @param parentId - The _id of the parent todo
 * @param enabled - Whether the query should run
 */
export function useChildTodos(parentId: string | null | undefined, enabled = true) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'children', parentId],
    queryFn: async () => {
      if (!parentId) return [];

      const children = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          parentId,
        },
        { limit: 100 },
      );

      return children.sort((a, b) => a.title.localeCompare(b.title));
    },
    enabled: !!safeDb && !!parentId && enabled,
  });
}

/**
 * Fetches the parent todo if parentId is set
 * @param parentId - The _id of the parent todo
 * @param enabled - Whether the query should run
 */
export function useParentTodo(parentId: string | null | undefined, enabled = true) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'parent', parentId],
    queryFn: async () => {
      if (!parentId) return null;

      const parent = await safeDb.safeGet<Todo>(parentId);
      return parent;
    },
    enabled: !!safeDb && !!parentId && enabled,
  });
}

/**
 * Counts children of a todo (for display in list views)
 * @param parentId - The _id of the parent todo
 * @param enabled - Whether the query should run
 */
export function useChildCount(parentId: string | null | undefined, enabled = true) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'childCount', parentId],
    queryFn: async () => {
      if (!parentId) return 0;

      const children = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          parentId,
        },
        { limit: 100 },
      );

      return children.length;
    },
    enabled: !!safeDb && !!parentId && enabled,
  });
}

/**
 * Fetches a todo by ID (generic version for any relationship lookup)
 * @param todoId - The _id of the todo to fetch
 * @param enabled - Whether the query should run
 */
export function useTodoById(todoId: string | null | undefined, enabled = true) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byId', todoId],
    queryFn: async () => {
      if (!todoId) return null;

      const todo = await safeDb.safeGet<Todo>(todoId);
      return todo;
    },
    enabled: !!safeDb && !!todoId && enabled,
  });
}

/**
 * Fetches child todos for specific parent IDs and computes subtask counts.
 * Only queries children whose parentId is in the provided list.
 * Single query shared across all table rows - avoids N+1 queries.
 * @param parentIds - Array of parent todo IDs to fetch children for
 * @param enabled - Whether the query should run
 * @returns Map<parentId, SubtaskCount>
 */
export function useSubtaskCountsForParents(parentIds: string[], enabled = true) {
  const { safeDb } = usePouchDb();

  // Create a stable key from sorted parent IDs
  const parentIdsKey = useMemo(() => [...parentIds].sort().join(','), [parentIds]);

  return useQuery({
    queryKey: ['todos', 'subtaskCounts', parentIdsKey],
    queryFn: async () => {
      if (parentIds.length === 0) {
        return new Map<string, SubtaskCount>();
      }

      // Query children where parentId is one of our visible parents
      // PouchDB Mango supports $in operator for this
      const children = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          parentId: { $in: parentIds },
        },
        { limit: 10000 },
      );

      // Compute counts per parent
      const counts = new Map<string, SubtaskCount>();
      for (const child of children) {
        if (!child.parentId) continue;
        const existing = counts.get(child.parentId) ?? { total: 0, completed: 0 };
        existing.total += 1;
        if (child.completed !== null) {
          existing.completed += 1;
        }
        counts.set(child.parentId, existing);
      }

      return counts;
    },
    enabled: !!safeDb && enabled && parentIds.length > 0,
  });
}
