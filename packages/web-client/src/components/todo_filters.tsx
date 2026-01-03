import { add, format, getISOWeek, sub } from 'date-fns';
import { Button } from 'flowbite-react';
import { type FC } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

import { FOCUS_RING, TRANSITION } from '../styles/interactive';

import { useEddoContexts } from '../hooks/use_eddo_contexts';
import { useTags } from '../hooks/use_tags';
import type { ViewMode } from '../hooks/use_view_preferences';
import { ColumnPicker } from './column_picker';
import { EddoContextFilter } from './eddo_context_filter';
import type { CompletionStatus } from './status_filter';
import { StatusFilter } from './status_filter';
import { TagFilter } from './tag_filter';
import type { TimeRange } from './time_range_filter';
import { TimeRangeFilter } from './time_range_filter';
import { ViewModeToggle } from './view_mode_toggle';

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
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tableColumns: string[];
  onTableColumnsChange: (columns: string[]) => void;
  isViewPrefsLoading?: boolean;
}

const getPeriodLabel = (currentDate: Date, timeRange: TimeRange): string => {
  switch (timeRange.type) {
    case 'current-day':
      return format(currentDate, 'MMM d, yyyy');
    case 'current-week':
      return `CW${getISOWeek(currentDate)}`;
    case 'current-month':
      return format(currentDate, 'MMM yyyy');
    case 'current-year':
      return format(currentDate, 'yyyy');
    case 'custom':
      if (timeRange.startDate && timeRange.endDate) {
        const start = format(new Date(timeRange.startDate), 'MMM d');
        const end = format(new Date(timeRange.endDate), 'MMM d, yyyy');
        return `${start} - ${end}`;
      }
      return 'Custom Range';
    case 'all-time':
      return 'All Time';
    default:
      return 'Period';
  }
};

const getCustomRangeDays = (timeRange: TimeRange): number => {
  if (!timeRange.startDate || !timeRange.endDate) return 0;
  const start = new Date(timeRange.startDate);
  const end = new Date(timeRange.endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
};

const navigatePeriod = (
  currentDate: Date,
  timeRange: TimeRange,
  direction: 'prev' | 'next',
): Date => {
  const addOrSub = direction === 'next' ? add : sub;
  switch (timeRange.type) {
    case 'current-day':
      return addOrSub(currentDate, { days: 1 });
    case 'current-week':
      return addOrSub(currentDate, { weeks: 1 });
    case 'current-month':
      return addOrSub(currentDate, { months: 1 });
    case 'current-year':
      return addOrSub(currentDate, { years: 1 });
    case 'custom':
      return addOrSub(currentDate, { days: getCustomRangeDays(timeRange) });
    default:
      return currentDate;
  }
};

interface FilterRowProps {
  viewMode: ViewMode;
  isViewPrefsLoading: boolean;
  tableColumns: string[];
  onViewModeChange: (mode: ViewMode) => void;
  onTableColumnsChange: (columns: string[]) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (timeRange: TimeRange) => void;
  selectedStatus: CompletionStatus;
  setSelectedStatus: (status: CompletionStatus) => void;
  allContexts: string[];
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  allTags: string[];
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
}

const FilterRow: FC<FilterRowProps> = (props) => (
  <>
    <ViewModeToggle
      isLoading={props.isViewPrefsLoading}
      onViewModeChange={props.onViewModeChange}
      viewMode={props.viewMode}
    />
    {props.viewMode === 'table' && (
      <ColumnPicker
        onColumnsChange={props.onTableColumnsChange}
        selectedColumns={props.tableColumns}
      />
    )}
    <TimeRangeFilter
      onTimeRangeChange={props.setSelectedTimeRange}
      selectedTimeRange={props.selectedTimeRange}
    />
    <StatusFilter onStatusChange={props.setSelectedStatus} selectedStatus={props.selectedStatus} />
    <EddoContextFilter
      availableContexts={props.allContexts}
      onContextsChange={props.setSelectedContexts}
      selectedContexts={props.selectedContexts}
    />
    <TagFilter
      availableTags={props.allTags}
      onTagsChange={props.setSelectedTags}
      selectedTags={props.selectedTags}
    />
  </>
);

interface PeriodNavigationProps {
  currentDate: Date;
  selectedTimeRange: TimeRange;
  onNavigate: (direction: 'prev' | 'next') => void;
  onReset: () => void;
}

const PeriodNavigation: FC<PeriodNavigationProps> = ({
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
      </Button>{' '}
      <button
        className={`cursor-pointer font-semibold ${TRANSITION} hover:text-primary-600 dark:hover:text-primary-400 rounded-lg text-neutral-900 dark:text-white ${FOCUS_RING}`}
        onClick={onReset}
        title="Return to current period"
        type="button"
      >
        {getPeriodLabel(currentDate, selectedTimeRange)}
      </button>{' '}
      <Button className="p-0" color="gray" onClick={() => onNavigate('next')} size="xs">
        <RiArrowRightSLine size="2em" />
      </Button>
    </>
  );
};

export const TodoFilters: FC<TodoFiltersProps> = (props) => {
  const { allTags } = useTags();
  const { allContexts } = useEddoContexts();

  const handleNavigate = (direction: 'prev' | 'next') => {
    props.setCurrentDate(navigatePeriod(props.currentDate, props.selectedTimeRange, direction));
  };

  return (
    <div className="flex items-center space-x-4 bg-white pb-3 dark:bg-neutral-800">
      <FilterRow
        allContexts={allContexts}
        allTags={allTags}
        isViewPrefsLoading={props.isViewPrefsLoading ?? false}
        onTableColumnsChange={props.onTableColumnsChange}
        onViewModeChange={props.onViewModeChange}
        selectedContexts={props.selectedContexts}
        selectedStatus={props.selectedStatus}
        selectedTags={props.selectedTags}
        selectedTimeRange={props.selectedTimeRange}
        setSelectedContexts={props.setSelectedContexts}
        setSelectedStatus={props.setSelectedStatus}
        setSelectedTags={props.setSelectedTags}
        setSelectedTimeRange={props.setSelectedTimeRange}
        tableColumns={props.tableColumns}
        viewMode={props.viewMode}
      />
      <PeriodNavigation
        currentDate={props.currentDate}
        onNavigate={handleNavigate}
        onReset={() => props.setCurrentDate(new Date())}
        selectedTimeRange={props.selectedTimeRange}
      />
    </div>
  );
};
