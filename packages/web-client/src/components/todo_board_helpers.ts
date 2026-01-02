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
  add,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import { CONTEXT_DEFAULT } from '../constants';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';

/** Date range for filtering */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/** Re-export Activity type for convenience */
export type ActivityItem = Activity;

/**
 * Calculate date range based on selected time range
 */
export function calculateDateRange(currentDate: Date, selectedTimeRange: TimeRange): DateRange {
  // TODO The 'add' is a CEST quick fix
  const currentStartOfWeek = add(startOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });
  const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });

  switch (selectedTimeRange.type) {
    case 'current-day':
      return {
        startDate: add(startOfDay(currentDate), { hours: 2 }),
        endDate: add(endOfDay(currentDate), { hours: 2 }),
      };
    case 'current-week':
      return {
        startDate: currentStartOfWeek,
        endDate: currentEndOfWeek,
      };
    case 'current-month':
      return {
        startDate: add(startOfMonth(currentDate), { hours: 2 }),
        endDate: add(endOfMonth(currentDate), { hours: 2 }),
      };
    case 'current-year':
      return {
        startDate: add(startOfYear(currentDate), { hours: 2 }),
        endDate: add(endOfYear(currentDate), { hours: 2 }),
      };
    case 'custom':
      if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
        return {
          startDate: new Date(selectedTimeRange.startDate + 'T00:00:00'),
          endDate: new Date(selectedTimeRange.endDate + 'T23:59:59'),
        };
      }
      return { startDate: currentStartOfWeek, endDate: currentEndOfWeek };
    case 'all-time':
      return {
        startDate: new Date('2000-01-01'),
        endDate: new Date('2099-12-31'),
      };
    default:
      return { startDate: currentStartOfWeek, endDate: currentEndOfWeek };
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
 * Apply all filters to todos
 */
export function filterTodos(
  todos: Todo[],
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
): Todo[] {
  let filtered = todos;
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
        // TODO The 'split' is a CEST quick fix
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
      // TODO The 'split' is a CEST quick fix
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
