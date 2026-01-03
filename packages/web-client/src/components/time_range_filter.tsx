import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

import {
  BTN_PRIMARY_SM,
  DROPDOWN_CONTAINER,
  INPUT_BASE,
  getDropdownItemClass,
  getFilterButtonClass,
} from '../styles/interactive';

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

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DateInput: FC<DateInputProps> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs text-neutral-500 dark:text-neutral-400">{label}</label>
    <input
      className={`mt-1 block w-full ${INPUT_BASE}`}
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
  <div className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-700">
    <DateInput label="Start date" onChange={onStartDateChange} value={startDate} />
    <DateInput label="End date" onChange={onEndDateChange} value={endDate} />
    <button
      className={`w-full ${BTN_PRIMARY_SM}`}
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
      className={getDropdownItemClass(isSelected)}
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
  <div className={`top-full w-64 p-3 ${DROPDOWN_CONTAINER}`}>
    <div className="mb-2">
      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Time range</h3>
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
        className={getFilterButtonClass(selectedTimeRange.type !== 'current-week')}
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
