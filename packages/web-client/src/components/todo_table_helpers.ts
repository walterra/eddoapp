/**
 * Helper functions for TodoTable component
 */
import { type Activity, type Todo, getFormattedDurationForActivities } from '@eddo/core-client';
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
 * Group todos by context
 */
export function groupTodosByContext(todos: Todo[]): Array<[string, Todo[]]> {
  const grouped = Array.from(group(todos, (d) => d.context ?? CONTEXT_DEFAULT));
  grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  return grouped;
}

/**
 * Calculate total duration by context
 */
export function calculateDurationByContext(activities: Activity[]): Record<string, string> {
  return Object.fromEntries(
    Array.from(group(activities, (d) => d.doc.context ?? CONTEXT_DEFAULT)).map((d) => [
      d[0],
      getFormattedDurationForActivities(d[1]),
    ]),
  );
}
