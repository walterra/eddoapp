/**
 * Type definitions for preset filter components
 */
import type { CurrentFilterState } from '../hooks/use_filter_presets';
import type { FilterPreset } from '../hooks/use_profile_types';

export interface PresetFilterDropdownProps {
  currentFilters: CurrentFilterState;
  onApplyPreset: (filters: CurrentFilterState) => void;
}

export interface SavePresetFormProps {
  onSave: (name: string, useRelativeDate: boolean) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export interface PresetItemProps {
  preset: FilterPreset;
  onApply: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  isLoading: boolean;
}

export interface PresetListProps {
  presets: FilterPreset[];
  isLoading: boolean;
  onApply: (preset: FilterPreset) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export interface PresetDropdownContentProps {
  presets: FilterPreset[];
  isLoading: boolean;
  showSaveForm: boolean;
  onApply: (preset: FilterPreset) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onSave: (name: string, useRelativeDate: boolean) => void;
  onShowSaveForm: () => void;
  onHideSaveForm: () => void;
}
