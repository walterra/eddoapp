/**
 * ViewSettingsPopover - Gear icon that opens a popover with view settings
 * Contains: Kanban/Table toggle, Column picker (for table view)
 */
import { Checkbox } from 'flowbite-react';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCog } from 'react-icons/hi';
import { MdTableChart, MdViewKanban } from 'react-icons/md';
import { TbVectorTriangle } from 'react-icons/tb';

import { useFloatingPosition } from '../hooks/use_floating_position';
import {
  AVAILABLE_COLUMNS,
  sortColumnsByCanonicalOrder,
  type ViewMode,
} from '../hooks/use_view_preferences';
import { TRANSITION_FAST } from '../styles/interactive';

interface ViewSettingsPopoverProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tableColumns: string[];
  onTableColumnsChange: (columns: string[]) => void;
  isLoading?: boolean;
}

const POPOVER_STYLES =
  'z-50 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

/** Hook for popover dismiss behavior (click outside, escape key) */
const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

interface ViewModeButtonProps {
  mode: ViewMode;
  currentMode: ViewMode;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const ViewModeButton: FC<ViewModeButtonProps> = ({
  mode,
  currentMode,
  icon,
  label,
  onClick,
  disabled,
}) => (
  <button
    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm ${
      currentMode === mode
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
        : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'
    }`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {icon}
    {label}
  </button>
);

interface ViewModeSectionProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isLoading?: boolean;
}

const ViewModeSection: FC<ViewModeSectionProps> = ({ viewMode, onViewModeChange, isLoading }) => (
  <div className="mb-3">
    <div className="mb-2 text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
      View Mode
    </div>
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-700">
      <ViewModeButton
        currentMode={viewMode}
        disabled={isLoading}
        icon={<MdViewKanban size="1.2em" />}
        label="Kanban"
        mode="kanban"
        onClick={() => onViewModeChange('kanban')}
      />
      <ViewModeButton
        currentMode={viewMode}
        disabled={isLoading}
        icon={<MdTableChart size="1.2em" />}
        label="Table"
        mode="table"
        onClick={() => onViewModeChange('table')}
      />
      <ViewModeButton
        currentMode={viewMode}
        disabled={isLoading}
        icon={<TbVectorTriangle size="1.2em" />}
        label="Graph"
        mode="graph"
        onClick={() => onViewModeChange('graph')}
      />
    </div>
  </div>
);

interface ColumnItemProps {
  id: string;
  label: string;
  isSelected: boolean;
  isLastSelected: boolean;
  onToggle: () => void;
}

const ColumnItem: FC<ColumnItemProps> = ({ label, isSelected, isLastSelected, onToggle }) => (
  <label
    className={`flex items-center gap-2 rounded px-2 py-1 ${
      isLastSelected
        ? 'cursor-not-allowed opacity-50'
        : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'
    }`}
  >
    <Checkbox checked={isSelected} disabled={isLastSelected} onChange={onToggle} />
    <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
  </label>
);

interface ColumnsSectionProps {
  tableColumns: string[];
  onToggleColumn: (columnId: string) => void;
}

const ColumnsSection: FC<ColumnsSectionProps> = ({ tableColumns, onToggleColumn }) => (
  <div>
    <div className="mb-2 text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
      Table Columns
    </div>
    <div className="max-h-48 space-y-0.5 overflow-y-auto">
      {AVAILABLE_COLUMNS.map((column) => {
        const isSelected = tableColumns.includes(column.id);
        const isLastSelected = isSelected && tableColumns.length === 1;
        return (
          <ColumnItem
            id={column.id}
            isLastSelected={isLastSelected}
            isSelected={isSelected}
            key={column.id}
            label={column.label}
            onToggle={() => onToggleColumn(column.id)}
          />
        );
      })}
    </div>
  </div>
);

interface PopoverContentProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tableColumns: string[];
  onToggleColumn: (columnId: string) => void;
  isLoading?: boolean;
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  onClose: () => void;
}

const PopoverContent: FC<PopoverContentProps> = ({
  viewMode,
  onViewModeChange,
  tableColumns,
  onToggleColumn,
  isLoading,
  floatingStyles,
  setFloatingRef,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, onClose);

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <ViewModeSection
        isLoading={isLoading}
        onViewModeChange={onViewModeChange}
        viewMode={viewMode}
      />
      {viewMode === 'table' && (
        <ColumnsSection onToggleColumn={onToggleColumn} tableColumns={tableColumns} />
      )}
    </div>,
    document.body,
  );
};

interface TriggerButtonProps {
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

const TriggerButton: FC<TriggerButtonProps> = ({ onClick, setReferenceRef }) => (
  <button
    aria-label="View settings"
    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
    onClick={onClick}
    ref={setReferenceRef}
    title="View settings"
    type="button"
  >
    <HiOutlineCog className="h-5 w-5" />
  </button>
);

export const ViewSettingsPopover: FC<ViewSettingsPopoverProps> = ({
  viewMode,
  onViewModeChange,
  tableColumns,
  onTableColumnsChange,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-end',
    open: isOpen,
  });

  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange(mode);
  };

  const handleToggleColumn = (columnId: string) => {
    const isSelected = tableColumns.includes(columnId);
    if (isSelected && tableColumns.length === 1) return;
    const updatedColumns = isSelected
      ? tableColumns.filter((id) => id !== columnId)
      : [...tableColumns, columnId];
    // Sort to maintain canonical order when columns are toggled
    const newColumns = sortColumnsByCanonicalOrder(updatedColumns);
    onTableColumnsChange(newColumns);
  };

  return (
    <>
      <TriggerButton onClick={() => setIsOpen(true)} setReferenceRef={refs.setReference} />
      {isOpen && (
        <PopoverContent
          floatingStyles={floatingStyles}
          isLoading={isLoading}
          onClose={() => setIsOpen(false)}
          onToggleColumn={handleToggleColumn}
          onViewModeChange={handleViewModeChange}
          setFloatingRef={refs.setFloating}
          tableColumns={tableColumns}
          viewMode={viewMode}
        />
      )}
    </>
  );
};
