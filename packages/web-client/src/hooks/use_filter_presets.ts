/**
 * Hook for managing filter presets CRUD operations
 */
import { useCallback, useMemo } from 'react';

import {
  type CreatePresetData,
  type CurrentFilterState,
  type UpdatePresetData,
  createFilterPreset,
  presetToFilterState,
} from './use_filter_presets_helpers';
import { useProfile } from './use_profile';
import type { FilterPreset, ProfileResult } from './use_profile_types';

export type { CreatePresetData, CurrentFilterState, UpdatePresetData };

export interface UseFilterPresetsReturn {
  presets: FilterPreset[];
  isLoading: boolean;
  createPreset: (data: CreatePresetData) => Promise<ProfileResult>;
  updatePreset: (data: UpdatePresetData) => Promise<ProfileResult>;
  deletePreset: (id: string) => Promise<ProfileResult>;
  applyPreset: (preset: FilterPreset) => CurrentFilterState;
}

/** Hook for managing filter presets */
export function useFilterPresets(): UseFilterPresetsReturn {
  const { profile, isLoading, updatePreferences } = useProfile();
  const presets = useMemo(() => profile?.preferences?.filterPresets ?? [], [profile]);

  const createPreset = useCallback(
    async (data: CreatePresetData): Promise<ProfileResult> => {
      if (!data.name.trim()) return { success: false, error: 'Preset name is required' };
      const newPreset = createFilterPreset(data);
      return updatePreferences({ filterPresets: [...presets, newPreset] });
    },
    [presets, updatePreferences],
  );

  const updatePreset = useCallback(
    async (data: UpdatePresetData): Promise<ProfileResult> => {
      const idx = presets.findIndex((p) => p.id === data.id);
      if (idx === -1) return { success: false, error: 'Preset not found' };
      if (data.name !== undefined && !data.name.trim()) {
        return { success: false, error: 'Preset name is required' };
      }
      const updated = [...presets];
      updated[idx] = { ...updated[idx], ...(data.name && { name: data.name.trim() }) };
      return updatePreferences({ filterPresets: updated });
    },
    [presets, updatePreferences],
  );

  const deletePreset = useCallback(
    async (id: string): Promise<ProfileResult> => {
      const filtered = presets.filter((p) => p.id !== id);
      if (filtered.length === presets.length) return { success: false, error: 'Preset not found' };
      return updatePreferences({ filterPresets: filtered });
    },
    [presets, updatePreferences],
  );

  const applyPreset = useCallback((preset: FilterPreset): CurrentFilterState => {
    return presetToFilterState(preset);
  }, []);

  return { presets, isLoading, createPreset, updatePreset, deletePreset, applyPreset };
}
