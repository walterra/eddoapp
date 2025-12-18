import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

export type TimeRangeType =
  | 'current-day'
  | 'current-week'
  | 'current-month'
  | 'current-year'
  | 'all-time'
  | 'custom';

export interface TimeRange {
  type: TimeRangeType;
  startDate?: string;
  endDate?: string;
}

interface TimeRangeFilterProps {
  selectedTimeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
}

export const TimeRangeFilter: FC<TimeRangeFilterProps> = ({
  selectedTimeRange,
  onTimeRangeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const timeRangeOptions: { value: TimeRangeType; label: string }[] = [
    { value: 'current-day', label: 'Day' },
    { value: 'current-week', label: 'Week' },
    { value: 'current-month', label: 'Month' },
    { value: 'current-year', label: 'Year' },
    { value: 'all-time', label: 'All time' },
    { value: 'custom', label: 'Custom range' },
  ];

  const getCurrentTimeRangeLabel = () => {
    const option = timeRangeOptions.find((opt) => opt.value === selectedTimeRange.type);
    if (
      selectedTimeRange.type === 'custom' &&
      selectedTimeRange.startDate &&
      selectedTimeRange.endDate
    ) {
      return `${selectedTimeRange.startDate} to ${selectedTimeRange.endDate}`;
    }
    return option?.label || 'Week';
  };

  const handleTimeRangeSelect = (type: TimeRangeType) => {
    if (type === 'custom') {
      // Don't close dropdown for custom range
      return;
    }

    onTimeRangeChange({ type });
    setIsOpen(false);
  };

  const handleCustomRangeApply = () => {
    if (customStartDate && customEndDate) {
      onTimeRangeChange({
        type: 'custom',
        startDate: customStartDate,
        endDate: customEndDate,
      });
      setIsOpen(false);
    }
  };

  const isCustomRangeSelected = selectedTimeRange.type === 'custom';

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
          selectedTimeRange.type !== 'current-week'
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>{getCurrentTimeRangeLabel()}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Time range</h3>
            </div>

            <div className="space-y-1">
              {timeRangeOptions.map((option) => (
                <div key={option.value}>
                  <button
                    className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedTimeRange.type === option.value
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => handleTimeRangeSelect(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>

                  {option.value === 'custom' && isCustomRangeSelected && (
                    <div className="mt-2 space-y-2 rounded bg-gray-50 p-2 dark:bg-gray-700">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          Start date
                        </label>
                        <input
                          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          type="date"
                          value={customStartDate}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          End date
                        </label>
                        <input
                          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          type="date"
                          value={customEndDate}
                        />
                      </div>
                      <button
                        className="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={!customStartDate || !customEndDate}
                        onClick={handleCustomRangeApply}
                        type="button"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
