import { Checkbox } from 'flowbite-react';
import { type FC, useState } from 'react';
import { MdViewColumn } from 'react-icons/md';

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

export const ColumnPicker: FC<ColumnPickerProps> = ({ selectedColumns, onColumnsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (columnId: string) => {
    const isSelected = selectedColumns.includes(columnId);
    let newColumns: string[];

    if (isSelected) {
      // Don't allow deselecting if it's the last column
      if (selectedColumns.length === 1) {
        return;
      }
      newColumns = selectedColumns.filter((id) => id !== columnId);
    } else {
      newColumns = [...selectedColumns, columnId];
    }

    onColumnsChange(newColumns);
  };

  const selectedCount = selectedColumns.length;
  const totalCount = AVAILABLE_COLUMNS.length;

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdViewColumn size="1.2em" />
        <span className="hidden sm:inline">
          Columns ({selectedCount}/{totalCount})
        </span>
        <span className="sm:hidden">{selectedCount}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
              Visible Columns
            </div>
            <div className="space-y-2">
              {AVAILABLE_COLUMNS.map((column) => {
                const isSelected = selectedColumns.includes(column.id);
                const isLastSelected = isSelected && selectedColumns.length === 1;

                return (
                  <label
                    className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isLastSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                    key={column.id}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isLastSelected}
                      onChange={() => toggleColumn(column.id)}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
                  </label>
                );
              })}
            </div>
            {selectedColumns.length === 1 && (
              <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                At least one column must be visible
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
