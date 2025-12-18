import { add, format, getISOWeek, sub } from 'date-fns';
import { Button } from 'flowbite-react';
import { type FC } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

import { useEddoContexts } from '../hooks/use_eddo_contexts';
import { useTags } from '../hooks/use_tags';
import { EddoContextFilter } from './eddo_context_filter';
import type { CompletionStatus } from './status_filter';
import { StatusFilter } from './status_filter';
import { TagFilter } from './tag_filter';
import type { TimeRange } from './time_range_filter';
import { TimeRangeFilter } from './time_range_filter';

interface TodoFiltersProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  selectedStatus: CompletionStatus;
  setSelectedStatus: (status: CompletionStatus) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (timeRange: TimeRange) => void;
}

export const TodoFilters: FC<TodoFiltersProps> = ({
  currentDate,
  setCurrentDate,
  selectedTags,
  setSelectedTags,
  selectedContexts,
  setSelectedContexts,
  selectedStatus,
  setSelectedStatus,
  selectedTimeRange,
  setSelectedTimeRange,
}) => {
  const { allTags } = useTags();
  const { allContexts } = useEddoContexts();

  const currentCalendarWeek = getISOWeek(currentDate);

  function getPeriodLabel(): string {
    switch (selectedTimeRange.type) {
      case 'current-day':
        return format(currentDate, 'MMM d, yyyy');
      case 'current-week':
        return `CW${currentCalendarWeek}`;
      case 'current-month':
        return format(currentDate, 'MMM yyyy');
      case 'current-year':
        return format(currentDate, 'yyyy');
      case 'custom':
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = format(new Date(selectedTimeRange.startDate), 'MMM d');
          const end = format(new Date(selectedTimeRange.endDate), 'MMM d, yyyy');
          return `${start} - ${end}`;
        }
        return 'Custom Range';
      case 'all-time':
        return 'All Time';
      default:
        return 'Period';
    }
  }

  function previousPeriodClickHandler() {
    switch (selectedTimeRange.type) {
      case 'current-day':
        setCurrentDate(sub(currentDate, { days: 1 }));
        break;
      case 'current-week':
        setCurrentDate(sub(currentDate, { weeks: 1 }));
        break;
      case 'current-month':
        setCurrentDate(sub(currentDate, { months: 1 }));
        break;
      case 'current-year':
        setCurrentDate(sub(currentDate, { years: 1 }));
        break;
      case 'custom':
        // For custom ranges, navigate by the same duration as the current range
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = new Date(selectedTimeRange.startDate);
          const end = new Date(selectedTimeRange.endDate);
          const durationMs = end.getTime() - start.getTime();
          setCurrentDate(sub(currentDate, { days: durationMs / (1000 * 60 * 60 * 24) }));
        }
        break;
      // all-time doesn't have navigation
    }
  }

  function nextPeriodClickHandler() {
    switch (selectedTimeRange.type) {
      case 'current-day':
        setCurrentDate(add(currentDate, { days: 1 }));
        break;
      case 'current-week':
        setCurrentDate(add(currentDate, { weeks: 1 }));
        break;
      case 'current-month':
        setCurrentDate(add(currentDate, { months: 1 }));
        break;
      case 'current-year':
        setCurrentDate(add(currentDate, { years: 1 }));
        break;
      case 'custom':
        // For custom ranges, navigate by the same duration as the current range
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = new Date(selectedTimeRange.startDate);
          const end = new Date(selectedTimeRange.endDate);
          const durationMs = end.getTime() - start.getTime();
          setCurrentDate(add(currentDate, { days: durationMs / (1000 * 60 * 60 * 24) }));
        }
        break;
      // all-time doesn't have navigation
    }
  }

  return (
    <div className="flex items-center space-x-3 border-b border-gray-200 bg-white pb-4 dark:border-gray-700 dark:bg-gray-800">
      <TimeRangeFilter
        onTimeRangeChange={setSelectedTimeRange}
        selectedTimeRange={selectedTimeRange}
      />
      <StatusFilter onStatusChange={setSelectedStatus} selectedStatus={selectedStatus} />
      <EddoContextFilter
        availableContexts={allContexts}
        onContextsChange={setSelectedContexts}
        selectedContexts={selectedContexts}
      />
      <TagFilter
        availableTags={allTags}
        onTagsChange={setSelectedTags}
        selectedTags={selectedTags}
      />
      {selectedTimeRange.type !== 'all-time' && (
        <>
          <Button className="p-0" color="gray" onClick={previousPeriodClickHandler} size="xs">
            <RiArrowLeftSLine size="2em" />
          </Button>{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{getPeriodLabel()}</span>{' '}
          <Button className="p-0" color="gray" onClick={nextPeriodClickHandler} size="xs">
            <RiArrowRightSLine size="2em" />
          </Button>
        </>
      )}
    </div>
  );
};
