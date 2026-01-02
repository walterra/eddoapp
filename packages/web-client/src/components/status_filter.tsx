import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

export type CompletionStatus = 'all' | 'completed' | 'incomplete';

interface StatusFilterProps {
  selectedStatus: CompletionStatus;
  onStatusChange: (status: CompletionStatus) => void;
}

const statusOptions: { value: CompletionStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' },
];

const getStatusLabel = (status: CompletionStatus): string =>
  statusOptions.find((option) => option.value === status)?.label || 'All';

const getButtonClassName = (isActive: boolean): string =>
  isActive
    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300';

const getOptionClassName = (isSelected: boolean): string =>
  isSelected
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    : 'text-gray-700 dark:text-gray-300';

interface StatusOptionProps {
  option: { value: CompletionStatus; label: string };
  isSelected: boolean;
  onSelect: () => void;
}

const StatusOption: FC<StatusOptionProps> = ({ option, isSelected, onSelect }) => (
  <button
    className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getOptionClassName(isSelected)}`}
    onClick={onSelect}
    type="button"
  >
    {option.label}
  </button>
);

export const StatusFilter: FC<StatusFilterProps> = ({ selectedStatus, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleSelect = (value: CompletionStatus) => {
    onStatusChange(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${getButtonClassName(selectedStatus !== 'all')}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>{getStatusLabel(selectedStatus)}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 max-h-96 w-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div className="space-y-1">
              {statusOptions.map((option) => (
                <StatusOption
                  isSelected={selectedStatus === option.value}
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                  option={option}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
