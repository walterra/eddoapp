import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Todo } from '@eddo/core-shared';
import type { SafeDbOperations } from '../api/safe-db-operations';
import { usePouchDb } from '../pouch_db';

interface UseTodosByDateRangeParams {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  enabled?: boolean;
}

/**
 * Extracts todos from cache that fall within the requested date range.
 * Provides instant placeholder data while fresh data loads.
 */
function getPlaceholderTodos(
  queryClient: ReturnType<typeof useQueryClient>,
  startDate: string,
  endDate: string,
): Todo[] | undefined {
  // Get all cached todo data from any date range
  const cachedQueries = queryClient.getQueriesData<Todo[]>({
    queryKey: ['todos', 'byDueDate'],
  });

  // Flatten all cached todos
  const allCachedTodos = cachedQueries.flatMap(([, data]) => data || []);

  if (allCachedTodos.length === 0) return undefined;

  // Filter to requested date range
  const endDateWithTime = endDate + 'T\uffff';
  const filtered = allCachedTodos.filter(
    (todo) => todo.due && todo.due >= startDate && todo.due <= endDateWithTime,
  );

  // Deduplicate by _id (same todo might be in multiple cached ranges)
  const unique = [...new Map(filtered.map((t) => [t._id, t])).values()];

  return unique.length > 0 ? unique : undefined;
}

type DateRange = { start: string; end: string };

/** Formats a Date to YYYY-MM-DD string */
const toDateString = (d: Date): string => d.toISOString().split('T')[0];

type RangeType = 'day' | 'week' | 'month' | 'year' | 'custom';

/** Detects the range type based on start/end dates */
function detectRangeType(startDate: string, endDate: string): RangeType {
  const diffDays = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'day';
  if (diffDays >= 6 && diffDays <= 7) return 'week';
  if (diffDays >= 27 && diffDays <= 31) return 'month';
  if (diffDays >= 364 && diffDays <= 366) return 'year';
  return 'custom';
}

/** Gets prev/next day ranges */
function getAdjacentDays(startD: Date, endD: Date): DateRange[] {
  const prev = new Date(startD);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(endD);
  next.setDate(next.getDate() + 1);

  return [
    { start: toDateString(prev), end: toDateString(prev) },
    { start: toDateString(next), end: toDateString(next) },
  ];
}

/** Gets prev/next week ranges */
function getAdjacentWeeks(startD: Date, endD: Date): DateRange[] {
  const prevStart = new Date(startD);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(prevStart);
  prevEnd.setDate(prevEnd.getDate() + 6);

  const nextStart = new Date(endD);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextEnd.getDate() + 6);

  return [
    { start: toDateString(prevStart), end: toDateString(prevEnd) },
    { start: toDateString(nextStart), end: toDateString(nextEnd) },
  ];
}

/** Gets prev/next month ranges */
function getAdjacentMonths(startD: Date, endD: Date): DateRange[] {
  const prevStart = new Date(startD.getFullYear(), startD.getMonth() - 1, 1);
  const prevEnd = new Date(startD.getFullYear(), startD.getMonth(), 0);
  const nextStart = new Date(endD.getFullYear(), endD.getMonth() + 1, 1);
  const nextEnd = new Date(endD.getFullYear(), endD.getMonth() + 2, 0);

  return [
    { start: toDateString(prevStart), end: toDateString(prevEnd) },
    { start: toDateString(nextStart), end: toDateString(nextEnd) },
  ];
}

/** Gets prev/next year ranges */
function getAdjacentYears(startD: Date, endD: Date): DateRange[] {
  const prevStart = new Date(startD.getFullYear() - 1, 0, 1);
  const prevEnd = new Date(startD.getFullYear() - 1, 11, 31);
  const nextStart = new Date(endD.getFullYear() + 1, 0, 1);
  const nextEnd = new Date(endD.getFullYear() + 1, 11, 31);

  return [
    { start: toDateString(prevStart), end: toDateString(prevEnd) },
    { start: toDateString(nextStart), end: toDateString(nextEnd) },
  ];
}

/** Gets adjacent ranges based on detected range type */
function getAdjacentRanges(startDate: string, endDate: string): DateRange[] {
  const rangeType = detectRangeType(startDate, endDate);
  const startD = new Date(startDate);
  const endD = new Date(endDate);

  switch (rangeType) {
    case 'day':
      return getAdjacentDays(startD, endD);
    case 'week':
      return getAdjacentWeeks(startD, endD);
    case 'month':
      return getAdjacentMonths(startD, endD);
    case 'year':
      return getAdjacentYears(startD, endD);
    default:
      return []; // Custom ranges: don't prefetch
  }
}

/** Fetches todos for a date range - extracted for reuse in prefetch */
async function fetchTodosForRange(
  safeDb: SafeDbOperations,
  startDate: string,
  endDate: string,
): Promise<Todo[]> {
  return safeDb.safeFind<Todo>(
    {
      version: 'alpha3',
      due: { $gte: startDate, $lte: endDate + 'T\uffff' },
    },
    { limit: 10000 },
  );
}

interface PrefetchConfig {
  safeDb: SafeDbOperations | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  startDate: string;
  endDate: string;
  enabled: boolean;
  isLoading: boolean;
}

/**
 * Prefetches adjacent date ranges in the background using requestIdleCallback.
 * Automatically detects range type (day/week/month) and prefetches accordingly.
 * Only prefetches if data is not already cached.
 */
function usePrefetchAdjacentRanges(config: PrefetchConfig): void {
  const { safeDb, queryClient, startDate, endDate, enabled, isLoading } = config;

  useEffect(() => {
    if (!safeDb || !enabled || isLoading) return;

    const prefetchRange = (start: string, end: string) => {
      const queryKey = ['todos', 'byDueDate', start, end];

      // Skip if already cached
      if (queryClient.getQueryData(queryKey)) return;

      // Use requestIdleCallback to avoid blocking main thread
      const scheduleTask =
        typeof requestIdleCallback !== 'undefined'
          ? (cb: () => void) => requestIdleCallback(cb, { timeout: 3000 })
          : (cb: () => void) => setTimeout(cb, 100);

      scheduleTask(() => {
        queryClient
          .prefetchQuery({
            queryKey,
            queryFn: () => fetchTodosForRange(safeDb, start, end),
            staleTime: Infinity,
          })
          .catch(() => {
            // Ignore prefetch errors - not critical
          });
      });
    };

    // Get adjacent ranges based on current range type (day/week/month)
    const adjacentRanges = getAdjacentRanges(startDate, endDate);
    adjacentRanges.forEach((range) => prefetchRange(range.start, range.end));
  }, [safeDb, queryClient, startDate, endDate, enabled, isLoading]);
}

/**
 * Fetches todos for a date range using Mango queries (faster than MapReduce in PouchDB).
 * Uses date-only strings (YYYY-MM-DD) for comparison to avoid timezone issues.
 * Since ISO strings sort lexicographically, we use date prefixes for range queries.
 *
 * Features:
 * - placeholderData from cached queries for instant navigation feedback
 * - Background prefetch of adjacent ranges using requestIdleCallback
 * - Auto-detects range type (day/week/month) and prefetches prev/next accordingly
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with todos data
 */
export function useTodosByDateRange({
  startDate,
  endDate,
  enabled = true,
}: UseTodosByDateRangeParams) {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['todos', 'byDueDate', startDate, endDate],
    queryFn: async () => {
      const timerId = `fetchTodos-${Date.now()}`;
      console.time(timerId);
      const todos = await fetchTodosForRange(safeDb, startDate, endDate);
      console.timeEnd(timerId);
      return todos;
    },
    enabled: !!safeDb && enabled,

    // Show cached todos from other date ranges as placeholder while loading
    // This provides instant feedback when navigating between weeks
    placeholderData: () => getPlaceholderTodos(queryClient, startDate, endDate),
  });

  // Prefetch adjacent ranges in background after current query settles
  // Automatically detects day/week/month and prefetches prev/next accordingly
  usePrefetchAdjacentRanges({
    safeDb,
    queryClient,
    startDate,
    endDate,
    enabled,
    isLoading: query.isLoading,
  });

  return query;
}
