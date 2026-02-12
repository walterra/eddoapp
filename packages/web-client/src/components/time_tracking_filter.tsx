import { type FC, useState } from 'react';
import { MdTimer } from 'react-icons/md';

import {
  DROPDOWN_CONTAINER,
  getDropdownItemClass,
  getFilterButtonClass,
} from '../styles/interactive';

export type TimeTrackingStatus = 'all' | 'tracking' | 'not-tracking';

interface TimeTrackingFilterProps {
  selectedTimeTracking: TimeTrackingStatus;
  onTimeTrackingChange: (status: TimeTrackingStatus) => void;
}

interface TimeTrackingOption {
  value: TimeTrackingStatus;
  label: string;
}

const timeTrackingOptions: TimeTrackingOption[] = [
  { value: 'all', label: 'Tracking: all' },
  { value: 'tracking', label: 'Tracking: active' },
  { value: 'not-tracking', label: 'Tracking: inactive' },
];

const getTimeTrackingLabel = (status: TimeTrackingStatus): string => {
  const option = timeTrackingOptions.find((item) => item.value === status);
  return option?.label ?? 'Tracking: all';
};

interface TimeTrackingFilterOptionProps {
  option: TimeTrackingOption;
  isSelected: boolean;
  onSelect: () => void;
}

const TimeTrackingFilterOption: FC<TimeTrackingFilterOptionProps> = ({
  option,
  isSelected,
  onSelect,
}) => (
  <button className={getDropdownItemClass(isSelected)} onClick={onSelect} type="button">
    {option.label}
  </button>
);

export const TimeTrackingFilter: FC<TimeTrackingFilterProps> = ({
  selectedTimeTracking,
  onTimeTrackingChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (status: TimeTrackingStatus): void => {
    onTimeTrackingChange(status);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        className={getFilterButtonClass(selectedTimeTracking !== 'all')}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdTimer size="1.2em" />
        <span>{getTimeTrackingLabel(selectedTimeTracking)}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`top-full w-48 p-2 ${DROPDOWN_CONTAINER}`}>
            <div className="space-y-1">
              {timeTrackingOptions.map((option) => (
                <TimeTrackingFilterOption
                  isSelected={selectedTimeTracking === option.value}
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
