import { type FC } from 'react';
import { MdTableChart, MdViewKanban } from 'react-icons/md';

import type { ViewMode } from '../hooks/use_view_preferences';
import { TOGGLE_GROUP, getToggleButtonClass } from '../styles/interactive';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isLoading?: boolean;
}

export const ViewModeToggle: FC<ViewModeToggleProps> = ({
  viewMode,
  onViewModeChange,
  isLoading = false,
}) => {
  return (
    <div className={TOGGLE_GROUP}>
      <button
        className={getToggleButtonClass(viewMode === 'kanban')}
        disabled={isLoading}
        onClick={() => onViewModeChange('kanban')}
        title="Kanban View"
        type="button"
      >
        <MdViewKanban size="1.2em" />
        <span className="hidden sm:inline">Kanban</span>
      </button>
      <button
        className={getToggleButtonClass(viewMode === 'table')}
        disabled={isLoading}
        onClick={() => onViewModeChange('table')}
        title="Table View"
        type="button"
      >
        <MdTableChart size="1.2em" />
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
};
