/**
 * Hooks for parent-child todo relationships
 */
import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';

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
