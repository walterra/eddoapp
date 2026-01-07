/**
 * Preset filter dropdown trigger button
 */
import type { FC } from 'react';
import { MdBookmark, MdBookmarkBorder } from 'react-icons/md';

import { getFilterButtonClass } from '../styles/interactive';

interface PresetFilterButtonProps {
  hasPresets: boolean;
  presetCount: number;
  isOpen: boolean;
  onClick: () => void;
}

export const PresetFilterButton: FC<PresetFilterButtonProps> = ({
  hasPresets,
  presetCount,
  onClick,
}) => (
  <button className={getFilterButtonClass(hasPresets)} onClick={onClick} type="button">
    {hasPresets ? <MdBookmark size="1.2em" /> : <MdBookmarkBorder size="1.2em" />}
    <span>Presets</span>
    {hasPresets && (
      <span className="bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-200 rounded-full px-2 py-0.5 text-xs">
        {presetCount}
      </span>
    )}
  </button>
);
