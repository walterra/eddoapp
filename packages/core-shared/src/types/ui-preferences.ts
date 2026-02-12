/**
 * Shared UI preference types used by both server and client.
 */

/** Available view modes for todo display */
export type ViewMode = 'kanban' | 'table' | 'graph';

/** Theme preference for UI */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Completion status filter options */
export type CompletionStatus = 'all' | 'completed' | 'incomplete';

/** Time tracking filter options */
export type TimeTrackingStatus = 'all' | 'tracking' | 'not-tracking';

/** Time range filter type */
export type TimeRangeType =
  | 'current-day'
  | 'current-week'
  | 'current-month'
  | 'current-year'
  | 'all-time'
  | 'custom';
