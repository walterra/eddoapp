/**
 * Helper functions for TodoBoard component
 */
import {
  type Activity,
  type Todo,
  getFormattedDurationForActivities,
  isLatestVersion,
} from '@eddo/core-client';
import { group } from 'd3-array';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import { CONTEXT_DEFAULT } from '../constants';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';

/** Date range for filtering using date-only strings (YYYY-MM-DD) */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Re-export Activity type for convenience */
export type ActivityItem = Activity;

/**
 * Format a date as YYYY-MM-DD string (date-only, no timezone issues)
 */
function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Calculate date range based on selected time range.
 * Returns date-only strings (YYYY-MM-DD) to avoid timezone conversion issues.
 * Queries should use these as prefixes for ISO string comparison.
 */
export function calculateDateRange(currentDate: Date, selectedTimeRange: TimeRange): DateRange {
  const currentStartOfWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const currentEndOfWeek = endOfWeek(currentDate, { weekStartsOn: 1 });

  switch (selectedTimeRange.type) {
    case 'current-day':
      return {
        startDate: formatDateOnly(currentDate),
        endDate: formatDateOnly(currentDate),
      };
    case 'current-week':
      return {
        startDate: formatDateOnly(currentStartOfWeek),
        endDate: formatDateOnly(currentEndOfWeek),
      };
    case 'current-month':
      return {
        startDate: formatDateOnly(startOfMonth(currentDate)),
        endDate: formatDateOnly(endOfMonth(currentDate)),
      };
    case 'current-year':
      return {
        startDate: formatDateOnly(startOfYear(currentDate)),
        endDate: formatDateOnly(endOfYear(currentDate)),
      };
    case 'custom':
      if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
        return {
          startDate: selectedTimeRange.startDate,
          endDate: selectedTimeRange.endDate,
        };
      }
      return {
        startDate: formatDateOnly(currentStartOfWeek),
        endDate: formatDateOnly(currentEndOfWeek),
      };
    case 'all-time':
      return {
        startDate: '2000-01-01',
        endDate: '2099-12-31',
      };
    default:
      return {
        startDate: formatDateOnly(currentStartOfWeek),
        endDate: formatDateOnly(currentEndOfWeek),
      };
  }
}

/**
 * Filter todos by context
 */
function filterByContext(todos: Todo[], selectedContexts: string[]): Todo[] {
  if (selectedContexts.length === 0) return todos;
  return todos.filter((todo) => selectedContexts.includes(todo.context || CONTEXT_DEFAULT));
}

/**
 * Filter todos by completion status
 */
function filterByStatus(todos: Todo[], selectedStatus: CompletionStatus): Todo[] {
  if (selectedStatus === 'all') return todos;
  return todos.filter((todo) => {
    if (selectedStatus === 'completed') return todo.completed !== null;
    if (selectedStatus === 'incomplete') return todo.completed === null;
    return true;
  });
}

/**
 * Filter todos by tags
 */
function filterByTags(todos: Todo[], selectedTags: string[]): Todo[] {
  if (selectedTags.length === 0) return todos;
  return todos.filter((todo) => selectedTags.some((tag) => todo.tags.includes(tag)));
}

/**
 * Filter out child todos (those with a parentId set)
 * Child todos are displayed nested under their parent, not in the main view
 */
function filterOutChildTodos(todos: Todo[]): Todo[] {
  return todos.filter((todo) => !todo.parentId);
}

/**
 * Apply all filters to todos
 */
export function filterTodos(
  todos: Todo[],
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
): Todo[] {
  let filtered = todos;
  filtered = filterOutChildTodos(filtered);
  filtered = filterByContext(filtered, selectedContexts);
  filtered = filterByStatus(filtered, selectedStatus);
  filtered = filterByTags(filtered, selectedTags);
  return filtered;
}

/**
 * Apply filters to todos for graph view (includes children for relationship visualization)
 */
export function filterTodosForGraph(
  todos: Todo[],
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
): Todo[] {
  let filtered = todos;
  // Note: We don't filter out children in graph view to show parent/child relationships
  filtered = filterByContext(filtered, selectedContexts);
  filtered = filterByStatus(filtered, selectedStatus);
  filtered = filterByTags(filtered, selectedTags);
  return filtered;
}

/**
 * Check if activity passes context filter
 */
function activityPassesContextFilter(todo: Todo, selectedContexts: string[]): boolean {
  if (selectedContexts.length === 0) return true;
  return selectedContexts.includes(todo.context || CONTEXT_DEFAULT);
}

/**
 * Check if activity passes status filter
 */
function activityPassesStatusFilter(todo: Todo, selectedStatus: CompletionStatus): boolean {
  if (selectedStatus === 'all') return true;
  if (selectedStatus === 'completed') return todo.completed !== null;
  if (selectedStatus === 'incomplete') return todo.completed === null;
  return true;
}

/**
 * Check if activity passes tag filter
 */
function activityPassesTagFilter(todo: Todo, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  return selectedTags.some((tag) => todo.tags.includes(tag));
}

/**
 * Filter activities based on their associated todo
 */
export function filterActivities(
  activities: ActivityItem[],
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
): ActivityItem[] {
  return activities.filter((activity) => {
    const todo = activity.doc;
    return (
      activityPassesContextFilter(todo, selectedContexts) &&
      activityPassesStatusFilter(todo, selectedStatus) &&
      activityPassesTagFilter(todo, selectedTags)
    );
  });
}

/**
 * Group todos and activities by context and date
 */
export function groupByContextAndDate(
  filteredTodos: Todo[],
  filteredActivities: ActivityItem[],
): Array<[string, Map<string, Array<Todo | ActivityItem>>]> {
  const grouped = Array.from(
    group(
      [...filteredTodos, ...filteredActivities],
      (d) => {
        if (isLatestVersion(d)) {
          return d.context ?? CONTEXT_DEFAULT;
        }
        return (d as ActivityItem).doc.context ?? CONTEXT_DEFAULT;
      },
      (d) => {
        // Extract date-only portion (YYYY-MM-DD) from ISO strings for grouping
        if (isLatestVersion(d)) {
          return d.due.split('T')[0];
        }
        return (d as ActivityItem).from.split('T')[0];
      },
    ),
  );
  grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  return grouped;
}

/**
 * Calculate total duration by context
 */
export function calculateDurationByContext(activities: ActivityItem[]): Record<string, string> {
  return Object.fromEntries(
    Array.from(group(activities, (d) => d.doc.context ?? CONTEXT_DEFAULT)).map((d) => [
      d[0],
      getFormattedDurationForActivities(d[1]),
    ]),
  );
}

/**
 * Calculate duration by context and date
 */
export function calculateDurationByContextAndDate(
  activities: ActivityItem[],
): Array<[string, Map<string, ActivityItem[]>]> {
  const grouped = Array.from(
    group(
      activities,
      (d) => d.doc.context ?? CONTEXT_DEFAULT,
      // Extract date-only portion (YYYY-MM-DD) from ISO strings for grouping
      (d) => d.from.split('T')[0],
    ),
  );
  grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  return grouped;
}

/**
 * Get activity duration for a specific date
 */
export function getActivityDurationForDate(
  activityDurationByDate: Array<[string, string]>,
  displayDate: string,
): string {
  const item = activityDurationByDate.find((d) => d[0] === displayDate);
  return item ? item[1] : '';
}

/**
 * Format activity durations by date for a context
 */
export function formatActivityDurationsByDate(
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>,
  context: string,
): Array<[string, string]> {
  const activitiesByMapDate = durationByContextByDate.find((d) => d[0] === context);
  if (!activitiesByMapDate) return [];

  const result = Array.from(activitiesByMapDate[1]).map(
    (d) => [d[0], getFormattedDurationForActivities(d[1])] as [string, string],
  );
  result.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  return result;
}
