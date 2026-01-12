/**
 * Period navigation component for todo filters
 */
import { Button } from 'flowbite-react';
import type { FC } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

import { FOCUS_RING, TRANSITION } from '../styles/interactive';

import { getPeriodLabel } from './todo_filters_helpers';
import type { PeriodNavigationProps } from './todo_filters_types';

export const PeriodNavigation: FC<PeriodNavigationProps> = ({
  currentDate,
  selectedTimeRange,
  onNavigate,
  onReset,
}) => {
  if (selectedTimeRange.type === 'all-time') return null;

  return (
    <>
      <Button className="p-0" color="gray" onClick={() => onNavigate('prev')} size="xs">
        <RiArrowLeftSLine size="2em" />
      </Button>
      <button
        className={`cursor-pointer font-semibold whitespace-nowrap ${TRANSITION} hover:text-primary-600 dark:hover:text-primary-400 rounded-lg text-neutral-900 dark:text-white ${FOCUS_RING}`}
        onClick={onReset}
        title="Return to current period"
        type="button"
      >
        {getPeriodLabel(currentDate, selectedTimeRange)}
      </button>
      <Button className="p-0" color="gray" onClick={() => onNavigate('next')} size="xs">
        <RiArrowRightSLine size="2em" />
      </Button>
    </>
  );
};
