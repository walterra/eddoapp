import { useCallback, useMemo } from 'react';

import { useProfile } from './use_profile';

export type ViewMode = 'kanban' | 'table';

export const DEFAULT_TABLE_COLUMNS = ['status', 'title', 'due', 'tags', 'timeTracked'];

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
    () => profile?.preferences?.tableColumns || DEFAULT_TABLE_COLUMNS,
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
