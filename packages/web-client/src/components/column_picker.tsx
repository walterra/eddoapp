import { Checkbox } from 'flowbite-react';
import { type FC, useState } from 'react';
import { MdViewColumn } from 'react-icons/md';

import { FILTER_BUTTON_INACTIVE, TRANSITION } from '../styles/interactive';

export interface ColumnOption {
  id: string;
  label: string;
}

const AVAILABLE_COLUMNS: ColumnOption[] = [
  { id: 'title', label: 'Title' },
  { id: 'context', label: 'Context' },
  { id: 'due', label: 'Due Date' },
  { id: 'tags', label: 'Tags' },
  { id: 'timeTracked', label: 'Time Tracked' },
  { id: 'status', label: 'Status' },
  { id: 'completed', label: 'Completed Date' },
  { id: 'repeat', label: 'Repeat' },
  { id: 'link', label: 'Link' },
  { id: 'description', label: 'Description' },
];

interface ColumnPickerProps {
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

interface ColumnItemProps {
  column: ColumnOption;
  isSelected: boolean;
  isLastSelected: boolean;
  onToggle: () => void;
}

const ColumnItem: FC<ColumnItemProps> = ({ column, isSelected, isLastSelected, onToggle }) => (
  <label
    className={`flex items-center gap-2 rounded px-2 py-1 ${TRANSITION} hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
      isLastSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
    }`}
  >
    <Checkbox checked={isSelected} disabled={isLastSelected} onChange={onToggle} />
    <span className="text-sm text-neutral-700 dark:text-neutral-300">{column.label}</span>
  </label>
);

interface ColumnListProps {
  selectedColumns: string[];
  onToggle: (columnId: string) => void;
}

const ColumnList: FC<ColumnListProps> = ({ selectedColumns, onToggle }) => (
  <div className="space-y-2">
    {AVAILABLE_COLUMNS.map((column) => {
      const isSelected = selectedColumns.includes(column.id);
      const isLastSelected = isSelected && selectedColumns.length === 1;
      return (
        <ColumnItem
          column={column}
          isLastSelected={isLastSelected}
          isSelected={isSelected}
          key={column.id}
          onToggle={() => onToggle(column.id)}
        />
      );
    })}
  </div>
);

export const ColumnPicker: FC<ColumnPickerProps> = ({ selectedColumns, onColumnsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (columnId: string) => {
    const isSelected = selectedColumns.includes(columnId);
    if (isSelected && selectedColumns.length === 1) return;
    const newColumns = isSelected
      ? selectedColumns.filter((id) => id !== columnId)
      : [...selectedColumns, columnId];
    onColumnsChange(newColumns);
  };

  return (
    <div className="relative">
      <button className={FILTER_BUTTON_INACTIVE} onClick={() => setIsOpen(!isOpen)} type="button">
        <MdViewColumn size="1.2em" />
        <span className="hidden sm:inline">
          Columns ({selectedColumns.length}/{AVAILABLE_COLUMNS.length})
        </span>
        <span className="sm:hidden">{selectedColumns.length}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
            <div className="mb-2 text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
              Visible Columns
            </div>
            <ColumnList onToggle={toggleColumn} selectedColumns={selectedColumns} />
            {selectedColumns.length === 1 && (
              <div className="mt-2 border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
                At least one column must be visible
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
