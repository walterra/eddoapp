/**
 * Dropdown for managing and applying filter presets
 */
import { type FC, useState } from 'react';

import { usePresetHandlers } from '../hooks/use_preset_handlers';

import { PresetFilterButton } from './preset_filter_button';
import { PresetDropdownContent } from './preset_filter_content';
import type { PresetFilterDropdownProps } from './preset_filter_types';

export const PresetFilterDropdown: FC<PresetFilterDropdownProps> = ({
  currentFilters,
  onApplyPreset,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
    handlers.setShowSaveForm(false);
  };

  const handlers = usePresetHandlers({ currentFilters, onApplyPreset, onClose: handleClose });
  const hasPresets = handlers.presets.length > 0;

  return (
    <div className="relative">
      <PresetFilterButton
        hasPresets={hasPresets}
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        presetCount={handlers.presets.length}
      />
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={handleClose} />
          <PresetDropdownContent
            isLoading={handlers.isLoading || handlers.isOperating}
            onApply={handlers.handleApply}
            onDelete={handlers.handleDelete}
            onHideSaveForm={() => handlers.setShowSaveForm(false)}
            onRename={handlers.handleRename}
            onSave={handlers.handleSave}
            onShowSaveForm={() => handlers.setShowSaveForm(true)}
            presets={handlers.presets}
            showSaveForm={handlers.showSaveForm}
          />
        </>
      )}
    </div>
  );
};
