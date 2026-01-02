import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

import { getDropdownItemClass, getFilterButtonClass } from '../styles/interactive';

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

interface StatusOptionProps {
  option: { value: CompletionStatus; label: string };
  isSelected: boolean;
  onSelect: () => void;
}

const StatusOption: FC<StatusOptionProps> = ({ option, isSelected, onSelect }) => (
  <button className={getDropdownItemClass(isSelected)} onClick={onSelect} type="button">
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
        className={getFilterButtonClass(selectedStatus !== 'all')}
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
