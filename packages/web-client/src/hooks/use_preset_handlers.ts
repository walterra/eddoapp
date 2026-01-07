/**
 * Hook for preset dropdown event handlers
 */
import { useCallback, useState } from 'react';

import type { CurrentFilterState } from './use_filter_presets';
import { useFilterPresets } from './use_filter_presets';
import type { FilterPreset } from './use_profile_types';

interface UsePresetHandlersOptions {
  currentFilters: CurrentFilterState;
  onApplyPreset: (filters: CurrentFilterState) => void;
  onClose: () => void;
}

export interface UsePresetHandlersReturn {
  presets: FilterPreset[];
  isLoading: boolean;
  isOperating: boolean;
  showSaveForm: boolean;
  setShowSaveForm: (show: boolean) => void;
  handleSave: (name: string, useRelativeDate: boolean) => Promise<void>;
  handleApply: (preset: FilterPreset) => void;
  handleRename: (id: string, newName: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

/** Create save handler bound to createPreset */
function useSaveHandler(
  createPreset: ReturnType<typeof useFilterPresets>['createPreset'],
  currentFilters: CurrentFilterState,
  setIsOperating: (v: boolean) => void,
  setShowSaveForm: (v: boolean) => void,
) {
  return useCallback(
    async (name: string, useRelativeDate: boolean) => {
      setIsOperating(true);
      const result = await createPreset({ name, filters: currentFilters, useRelativeDate });
      setIsOperating(false);
      if (result.success) setShowSaveForm(false);
    },
    [createPreset, currentFilters, setIsOperating, setShowSaveForm],
  );
}

/** Hook for managing preset dropdown handlers */
export function usePresetHandlers({
  currentFilters,
  onApplyPreset,
  onClose,
}: UsePresetHandlersOptions): UsePresetHandlersReturn {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const { presets, isLoading, createPreset, updatePreset, deletePreset, applyPreset } =
    useFilterPresets();

  const handleSave = useSaveHandler(createPreset, currentFilters, setIsOperating, setShowSaveForm);

  const handleApply = useCallback(
    (preset: FilterPreset) => {
      onApplyPreset(applyPreset(preset));
      onClose();
    },
    [applyPreset, onApplyPreset, onClose],
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      setIsOperating(true);
      await updatePreset({ id, name: newName });
      setIsOperating(false);
    },
    [updatePreset],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setIsOperating(true);
      await deletePreset(id);
      setIsOperating(false);
    },
    [deletePreset],
  );

  return {
    presets,
    isLoading,
    isOperating,
    showSaveForm,
    setShowSaveForm,
    handleSave,
    handleApply,
    handleRename,
    handleDelete,
  };
}
