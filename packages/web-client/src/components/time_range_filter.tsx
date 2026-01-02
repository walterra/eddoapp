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

const timeRangeOptions: { value: TimeRangeType; label: string }[] = [
  { value: 'current-day', label: 'Day' },
  { value: 'current-week', label: 'Week' },
  { value: 'current-month', label: 'Month' },
  { value: 'current-year', label: 'Year' },
  { value: 'all-time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const getTimeRangeLabel = (timeRange: TimeRange): string => {
  if (timeRange.type === 'custom' && timeRange.startDate && timeRange.endDate) {
    return `${timeRange.startDate} to ${timeRange.endDate}`;
  }
  return timeRangeOptions.find((opt) => opt.value === timeRange.type)?.label || 'Week';
};

const getButtonClassName = (isNonDefault: boolean): string =>
  isNonDefault
    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300';

const getOptionClassName = (isSelected: boolean): string =>
  isSelected
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    : 'text-gray-700 dark:text-gray-300';

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DateInput: FC<DateInputProps> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs text-gray-500 dark:text-gray-400">{label}</label>
    <input
      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      onChange={(e) => onChange(e.target.value)}
      type="date"
      value={value}
    />
  </div>
);

interface CustomDateRangeProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
}

const CustomDateRange: FC<CustomDateRangeProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
}) => (
  <div className="mt-2 space-y-2 rounded bg-gray-50 p-2 dark:bg-gray-700">
    <DateInput label="Start date" onChange={onStartDateChange} value={startDate} />
    <DateInput label="End date" onChange={onEndDateChange} value={endDate} />
    <button
      className="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
      disabled={!startDate || !endDate}
      onClick={onApply}
      type="button"
    >
      Apply
    </button>
  </div>
);

interface TimeRangeOptionProps {
  option: { value: TimeRangeType; label: string };
  isSelected: boolean;
  isCustomExpanded: boolean;
  customRangeProps: CustomDateRangeProps;
  onSelect: (type: TimeRangeType) => void;
}

const TimeRangeOption: FC<TimeRangeOptionProps> = ({
  option,
  isSelected,
  isCustomExpanded,
  customRangeProps,
  onSelect,
}) => (
  <div>
    <button
      className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getOptionClassName(isSelected)}`}
      onClick={() => onSelect(option.value)}
      type="button"
    >
      {option.label}
    </button>
    {option.value === 'custom' && isCustomExpanded && <CustomDateRange {...customRangeProps} />}
  </div>
);

interface DropdownContentProps {
  selectedTimeRange: TimeRange;
  customStartDate: string;
  customEndDate: string;
  setCustomStartDate: (date: string) => void;
  setCustomEndDate: (date: string) => void;
  handleTimeRangeSelect: (type: TimeRangeType) => void;
  handleCustomRangeApply: () => void;
}

const DropdownContent: FC<DropdownContentProps> = ({
  selectedTimeRange,
  customStartDate,
  customEndDate,
  setCustomStartDate,
  setCustomEndDate,
  handleTimeRangeSelect,
  handleCustomRangeApply,
}) => (
  <div className="absolute top-full z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
    <div className="mb-2">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Time range</h3>
    </div>
    <div className="space-y-1">
      {timeRangeOptions.map((option) => (
        <TimeRangeOption
          customRangeProps={{
            startDate: customStartDate,
            endDate: customEndDate,
            onStartDateChange: setCustomStartDate,
            onEndDateChange: setCustomEndDate,
            onApply: handleCustomRangeApply,
          }}
          isCustomExpanded={selectedTimeRange.type === 'custom'}
          isSelected={selectedTimeRange.type === option.value}
          key={option.value}
          onSelect={handleTimeRangeSelect}
          option={option}
        />
      ))}
    </div>
  </div>
);

export const TimeRangeFilter: FC<TimeRangeFilterProps> = ({
  selectedTimeRange,
  onTimeRangeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const handleTimeRangeSelect = (type: TimeRangeType) => {
    if (type !== 'custom') {
      onTimeRangeChange({ type });
      setIsOpen(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (customStartDate && customEndDate) {
      onTimeRangeChange({ type: 'custom', startDate: customStartDate, endDate: customEndDate });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${getButtonClassName(selectedTimeRange.type !== 'current-week')}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>{getTimeRangeLabel(selectedTimeRange)}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <DropdownContent
            customEndDate={customEndDate}
            customStartDate={customStartDate}
            handleCustomRangeApply={handleCustomRangeApply}
            handleTimeRangeSelect={handleTimeRangeSelect}
            selectedTimeRange={selectedTimeRange}
            setCustomEndDate={setCustomEndDate}
            setCustomStartDate={setCustomStartDate}
          />
        </>
      )}
    </div>
  );
};
