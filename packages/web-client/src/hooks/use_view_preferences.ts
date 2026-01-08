import { useCallback, useMemo } from 'react';

import { useProfile } from './use_profile';

export type ViewMode = 'kanban' | 'table';

/** Column definition with id and display label */
export interface ColumnDefinition {
  id: string;
  label: string;
}

/** Canonical list of all available columns in display order */
export const AVAILABLE_COLUMNS: readonly ColumnDefinition[] = [
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Title' },
  { id: 'due', label: 'Due Date' },
  { id: 'tags', label: 'Tags' },
  { id: 'timeTracked', label: 'Time Tracked' },
  { id: 'subtasks', label: 'Subtasks' },
  { id: 'context', label: 'Context' },
  { id: 'completed', label: 'Completed Date' },
  { id: 'repeat', label: 'Repeat' },
  { id: 'link', label: 'Link' },
  { id: 'description', label: 'Description' },
] as const;

/** Column IDs in canonical order for quick lookup */
const CANONICAL_COLUMN_ORDER = AVAILABLE_COLUMNS.map((col) => col.id);

/**
 * Sorts column IDs to match canonical order defined in AVAILABLE_COLUMNS.
 * Unknown columns are appended at the end in their original order.
 * @param columns - Array of column IDs to sort
 * @returns New array sorted by canonical order
 */
export function sortColumnsByCanonicalOrder(columns: readonly string[]): string[] {
  const columnSet = new Set(columns);
  const sorted: string[] = [];

  // Add columns in canonical order
  for (const canonicalId of CANONICAL_COLUMN_ORDER) {
    if (columnSet.has(canonicalId)) {
      sorted.push(canonicalId);
    }
  }

  // Append unknown columns at the end (preserves forward compatibility)
  for (const col of columns) {
    if (!CANONICAL_COLUMN_ORDER.includes(col)) {
      sorted.push(col);
    }
  }

  return sorted;
}

export const DEFAULT_TABLE_COLUMNS = ['status', 'title', 'due', 'tags', 'timeTracked', 'subtasks'];

export interface ViewPreferences {
  viewMode: ViewMode;
  tableColumns: string[];
}

export interface UseViewPreferencesReturn {
  viewMode: ViewMode;
  tableColumns: string[];
  isLoading: boolean;
  error: string | null;
  setViewMode: (mode: ViewMode) => Promise<{ success: boolean; error?: string }>;
  setTableColumns: (columns: string[]) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook for managing todo view preferences (kanban vs table, column selection)
 */
export const useViewPreferences = (): UseViewPreferencesReturn => {
  const { profile, isLoading, error, updatePreferences } = useProfile();

  const viewMode = useMemo<ViewMode>(
    () => profile?.preferences?.viewMode || 'kanban',
    [profile?.preferences?.viewMode],
  );

  const tableColumns = useMemo<string[]>(
    () => sortColumnsByCanonicalOrder(profile?.preferences?.tableColumns || DEFAULT_TABLE_COLUMNS),
    [profile?.preferences?.tableColumns],
  );

  const setViewMode = useCallback(
    async (mode: ViewMode) => {
      return await updatePreferences({ viewMode: mode });
    },
    [updatePreferences],
  );

  const setTableColumns = useCallback(
    async (columns: string[]) => {
      return await updatePreferences({ tableColumns: columns });
    },
    [updatePreferences],
  );

  return {
    viewMode,
    tableColumns,
    isLoading,
    error: error || null,
    setViewMode,
    setTableColumns,
  };
};
