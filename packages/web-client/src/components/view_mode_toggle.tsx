import { type FC } from 'react';
import { MdTableChart, MdViewKanban } from 'react-icons/md';

import type { ViewMode } from '../hooks/use_view_preferences';

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
    <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800">
      <button
        className={`flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors ${
          viewMode === 'kanban'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        disabled={isLoading}
        onClick={() => onViewModeChange('kanban')}
        title="Kanban View"
        type="button"
      >
        <MdViewKanban size="1.2em" />
        <span className="hidden sm:inline">Kanban</span>
      </button>
      <button
        className={`flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors ${
          viewMode === 'table'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
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
