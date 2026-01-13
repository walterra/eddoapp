/**
 * Hook for fetching children of expanded rows in the table
 * Uses plain objects instead of Maps to avoid TanStack Query structural sharing issues
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Todo } from '@eddo/core-shared';

import { usePouchDb } from '../pouch_db';
import { type SubtaskCount } from './use_parent_child';

/** Plain object result to avoid Map comparison issues */
interface ExpandedChildrenData {
  childrenByParent: Record<string, Todo[]>;
  childSubtaskCounts: Record<string, SubtaskCount>;
}

/** Groups children by their parentId into a plain object */
const groupChildrenByParent = (
  children: Todo[],
): { record: Record<string, Todo[]>; ids: string[] } => {
  const record: Record<string, Todo[]> = {};
  const ids: string[] = [];

  for (const child of children) {
    if (!child.parentId) continue;
    if (!record[child.parentId]) record[child.parentId] = [];
    record[child.parentId].push(child);
    ids.push(child._id);
  }

  // Sort children by title within each group
  for (const key of Object.keys(record)) {
    record[key].sort((a, b) => a.title.localeCompare(b.title));
  }

  return { record, ids };
};

/** Count children per parent ID into a plain object */
const countChildrenPerParent = (children: Todo[]): Record<string, SubtaskCount> => {
  const counts: Record<string, SubtaskCount> = {};
  for (const child of children) {
    if (!child.parentId) continue;
    if (!counts[child.parentId]) counts[child.parentId] = { total: 0, completed: 0 };
    counts[child.parentId].total++;
    if (child.completed) counts[child.parentId].completed++;
  }
  return counts;
};

/**
 * Fetches children for expanded parent IDs and subtask counts for those children.
 * Returns plain objects that are converted to Maps in useMemo for stable references.
 */
export function useExpandedChildren(expandedIds: Set<string>) {
  const { safeDb } = usePouchDb();

  // Create stable array from expanded IDs for the query
  const expandedIdsArray = useMemo(() => [...expandedIds].sort(), [expandedIds]);
  const hasExpandedIds = expandedIdsArray.length > 0;

  const query = useQuery({
    queryKey: ['todos', 'expandedChildren', expandedIdsArray],
    queryFn: async (): Promise<ExpandedChildrenData> => {
      // Fetch children of expanded parents
      const children = await safeDb.safeFind<Todo>(
        { version: 'alpha3', parentId: { $in: expandedIdsArray } },
        { limit: 10000 },
      );

      const { record: childrenByParent, ids: childIds } = groupChildrenByParent(children);

      // Fetch grandchildren to count them (for showing expand icons on children)
      if (childIds.length === 0) {
        return { childrenByParent, childSubtaskCounts: {} };
      }

      const grandchildren = await safeDb.safeFind<Todo>(
        { version: 'alpha3', parentId: { $in: childIds } },
        { limit: 10000 },
      );

      return {
        childrenByParent,
        childSubtaskCounts: countChildrenPerParent(grandchildren),
      };
    },
    enabled: !!safeDb && hasExpandedIds,
    staleTime: Infinity, // Never mark as stale
    gcTime: Infinity, // Never garbage collect
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Convert plain objects to Maps with stable references
  const childrenByParent = useMemo(() => {
    if (!query.data) return new Map<string, Todo[]>();
    return new Map(Object.entries(query.data.childrenByParent));
  }, [query.data]);

  const childSubtaskCounts = useMemo(() => {
    if (!query.data) return new Map<string, SubtaskCount>();
    return new Map(Object.entries(query.data.childSubtaskCounts));
  }, [query.data]);

  return { childrenByParent, childSubtaskCounts, isLoading: query.isLoading };
}
