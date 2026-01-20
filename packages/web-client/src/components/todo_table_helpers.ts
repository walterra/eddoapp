/**
 * Helper functions for TodoTable component
 */
import {
  type Activity,
  type Todo,
  getActiveDurationInRange,
  getFormattedDuration,
} from '@eddo/core-client';
import { group } from 'd3-array';

import { CONTEXT_DEFAULT } from '../constants';
import type { CompletionStatus } from './status_filter';

/**
 * Get column width class for a given column ID
 */
export function getColumnWidthClass(columnId: string): string {
  const widths: Record<string, string> = {
    title: '', // Flexible width
    subtasks: 'w-20',
    context: 'w-32',
    due: 'w-32',
    tags: 'w-48',
    timeTracked: 'w-28',
    status: 'w-10',
    completed: 'w-40',
    repeat: 'w-24',
    link: 'w-20',
    description: 'max-w-md',
  };
  return widths[columnId] || '';
}

/**
 * Reorder columns to put status first
 */
export function reorderColumnsWithStatusFirst(columns: string[]): string[] {
  const hasStatus = columns.includes('status');
  if (!hasStatus) return columns;
  const otherColumns = columns.filter((col) => col !== 'status');
  return ['status', ...otherColumns];
}

/**
 * Get column label for display
 */
export function getColumnLabel(columnId: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    subtasks: 'Subtasks',
    context: 'Context',
    due: 'Due Date',
    tags: 'Tags',
    timeTracked: 'Time Tracked',
    status: '',
    completed: 'Completed',
    repeat: 'Repeat',
    link: 'Link',
    description: 'Description',
  };
  return columnId in labels ? labels[columnId] : columnId;
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
 * Sort todos by due date ascending, then title ascending
 */
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    // Primary: due date ascending
    const dueCmp = a.due.localeCompare(b.due);
    if (dueCmp !== 0) return dueCmp;
    // Secondary: title ascending
    return a.title.localeCompare(b.title);
  });
}

/**
 * Group todos by context
 */
export function groupTodosByContext(todos: Todo[]): Array<[string, Todo[]]> {
  const grouped = Array.from(group(todos, (d) => d.context ?? CONTEXT_DEFAULT));
  // Sort context groups alphabetically
  grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  // Sort todos within each group by due date, then title
  return grouped.map(([context, contextTodos]) => [context, sortTodos(contextTodos)]);
}

/**
 * Filter activities by context
 */
function filterActivitiesByContext(activities: Activity[], selectedContexts: string[]): Activity[] {
  if (selectedContexts.length === 0) return activities;
  return activities.filter((activity) =>
    selectedContexts.includes(activity.doc.context || CONTEXT_DEFAULT),
  );
}

/**
 * Filter activities by completion status
 */
function filterActivitiesByStatus(
  activities: Activity[],
  selectedStatus: CompletionStatus,
): Activity[] {
  if (selectedStatus === 'all') return activities;
  return activities.filter((activity) => {
    if (selectedStatus === 'completed') return activity.doc.completed !== null;
    if (selectedStatus === 'incomplete') return activity.doc.completed === null;
    return true;
  });
}

/**
 * Filter activities by tags
 */
function filterActivitiesByTags(activities: Activity[], selectedTags: string[]): Activity[] {
  if (selectedTags.length === 0) return activities;
  return activities.filter((activity) =>
    selectedTags.some((tag) => activity.doc.tags.includes(tag)),
  );
}

/**
 * Apply all filters to activities.
 * Note: Child activities are NOT filtered out - their time counts toward context totals.
 * Child activities inherit their parent's context, so context filtering still works.
 */
export function filterActivities(
  activities: Activity[],
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
): Activity[] {
  let filtered = activities;
  filtered = filterActivitiesByContext(filtered, selectedContexts);
  filtered = filterActivitiesByStatus(filtered, selectedStatus);
  filtered = filterActivitiesByTags(filtered, selectedTags);
  return filtered;
}

/**
 * Calculate total duration by context from pre-computed todo durations.
 * Only counts time from visible parent items (child time is rolled up into parent).
 * @param todoDurations - Map of todoId -> duration in ms (including child time)
 * @param todos - Filtered todos (parents only, no children)
 */
export function calculateDurationByContext(
  todoDurations: Map<string, number>,
  todos: Todo[],
): Record<string, string> {
  const durationByContext = new Map<string, number>();

  for (const todo of todos) {
    const context = todo.context || CONTEXT_DEFAULT;
    const duration = todoDurations.get(todo._id) ?? 0;
    const current = durationByContext.get(context) ?? 0;
    durationByContext.set(context, current + duration);
  }

  return Object.fromEntries(
    Array.from(durationByContext.entries()).map(([context, duration]) => [
      context,
      getFormattedDuration(duration),
    ]),
  );
}

/**
 * Calculate duration per todo (own time + child time).
 * Returns a map for looking up total duration by todo ID.
 * @param todos - Filtered todos (parents only)
 * @param activities - All activities including child activities
 * @param startDate - Start of date range (yyyy-MM-dd)
 * @param endDate - End of date range (yyyy-MM-dd)
 * @returns Map of todoId -> total duration in milliseconds
 */
export function calculateTodoDurations(
  todos: readonly Todo[],
  activities: readonly Activity[],
  startDate: string,
  endDate: string,
): Map<string, number> {
  const result = new Map<string, number>();

  // First, calculate own duration for each parent todo
  for (const todo of todos) {
    const ownDuration = getActiveDurationInRange(todo.active, startDate, endDate);
    result.set(todo._id, ownDuration);
  }

  // Then, add child activity durations to their parents
  for (const activity of activities) {
    const parentId = activity.doc.parentId;
    if (!parentId) continue;

    // Only count if parent is in our filtered list
    if (!result.has(parentId)) continue;

    // Calculate duration for this activity within date range
    const entryDate = activity.from.split('T')[0];
    if (entryDate < startDate || entryDate > endDate) continue;

    const startTime = new Date(activity.from).getTime();
    const endTime = activity.to !== null ? new Date(activity.to).getTime() : Date.now();
    const childDuration = endTime - startTime;

    const current = result.get(parentId) ?? 0;
    result.set(parentId, current + childDuration);
  }

  return result;
}
