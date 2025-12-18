import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

export type CompletionStatus = 'all' | 'completed' | 'incomplete';

interface StatusFilterProps {
  selectedStatus: CompletionStatus;
  onStatusChange: (status: CompletionStatus) => void;
}

export const StatusFilter: FC<StatusFilterProps> = ({ selectedStatus, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions: { value: CompletionStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'incomplete', label: 'Incomplete' },
    { value: 'completed', label: 'Completed' },
  ];

  const currentStatusLabel =
    statusOptions.find((option) => option.value === selectedStatus)?.label || 'All';

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
          selectedStatus !== 'all'
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>{currentStatusLabel}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div className="space-y-1">
              {statusOptions.map((option) => (
                <button
                  className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedStatus === option.value
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  key={option.value}
                  onClick={() => {
                    onStatusChange(option.value);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
