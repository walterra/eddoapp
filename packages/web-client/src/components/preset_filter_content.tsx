/**
 * Preset dropdown content - list of presets and save form
 */
import type { FC } from 'react';
import { MdBookmarkBorder } from 'react-icons/md';

import { DROPDOWN_CONTAINER, FOCUS_RING, TRANSITION } from '../styles/interactive';

import { SavePresetForm } from './preset_filter_form';
import { PresetItem } from './preset_filter_item';
import type { PresetDropdownContentProps } from './preset_filter_types';

const EmptyState: FC = () => (
  <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
    No saved presets. Save your current filters for quick access.
  </p>
);

const SaveButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    className={`w-full ${TRANSITION} ${FOCUS_RING} hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-400 dark:hover:text-primary-400 flex items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400`}
    onClick={onClick}
    type="button"
  >
    <MdBookmarkBorder size="1.2em" />
    Save current filters
  </button>
);

export const PresetDropdownContent: FC<PresetDropdownContentProps> = ({
  presets,
  isLoading,
  showSaveForm,
  onApply,
  onRename,
  onDelete,
  onSave,
  onShowSaveForm,
  onHideSaveForm,
}) => {
  const hasPresets = presets.length > 0;

  return (
    <div className={`top-full w-72 p-3 ${DROPDOWN_CONTAINER}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Filter Presets
        </h3>
      </div>

      {hasPresets && (
        <div className="mb-3 space-y-1">
          {presets.map((preset) => (
            <PresetItem
              isLoading={isLoading}
              key={preset.id}
              onApply={() => onApply(preset)}
              onDelete={() => onDelete(preset.id)}
              onRename={(newName) => onRename(preset.id, newName)}
              preset={preset}
            />
          ))}
        </div>
      )}

      {!hasPresets && !showSaveForm && <EmptyState />}

      {showSaveForm ? (
        <SavePresetForm isLoading={isLoading} onCancel={onHideSaveForm} onSave={onSave} />
      ) : (
        <SaveButton onClick={onShowSaveForm} />
      )}
    </div>
  );
};
