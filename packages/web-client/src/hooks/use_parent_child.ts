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
