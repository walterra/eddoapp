/**
 * Todo filters toolbar component
 */
import { type FC, useCallback } from 'react';

import { useDateNavigationKeys } from '../hooks/use_date_navigation_keys';
import { useEddoContexts } from '../hooks/use_eddo_contexts';
import type { CurrentFilterState } from '../hooks/use_filter_presets';
import { useMediaQuery } from '../hooks/use_media_query';
import { useTags } from '../hooks/use_tags';
import type { ViewMode } from '../hooks/use_view_preferences';

import { AddTodoPopover } from './add_todo_popover';
import { navigatePeriod } from './todo_filters_helpers';
import { PeriodNavigation } from './todo_filters_navigation';
import { FilterRow } from './todo_filters_row';
import type { TodoFiltersProps } from './todo_filters_types';
import { ViewSettingsPopover } from './view_settings_popover';

export type { CompletionStatus } from './status_filter';
export type { TimeRange } from './time_range_filter';
export type { TimeTrackingStatus } from './time_tracking_filter';
export type { TodoFiltersProps } from './todo_filters_types';

/** Build preset apply handler - uses batch update if available */
function useApplyPresetHandler(props: TodoFiltersProps) {
  return useCallback(
    (filters: CurrentFilterState) => {
      if (props.batchUpdateFilters) {
        props.batchUpdateFilters({
          selectedTags: filters.selectedTags,
          selectedContexts: filters.selectedContexts,
          selectedStatus: filters.selectedStatus,
          selectedTimeTracking: filters.selectedTimeTracking,
          selectedTimeRange: filters.selectedTimeRange,
          currentDate: filters.currentDate,
        });
      } else {
        props.setSelectedTags(filters.selectedTags);
        props.setSelectedContexts(filters.selectedContexts);
        props.setSelectedStatus(filters.selectedStatus);
        props.setSelectedTimeTracking(filters.selectedTimeTracking);
        props.setSelectedTimeRange(filters.selectedTimeRange);
        props.setCurrentDate(filters.currentDate);
      }
    },
    [
      props.batchUpdateFilters,
      props.setSelectedTags,
      props.setSelectedContexts,
      props.setSelectedStatus,
      props.setSelectedTimeTracking,
      props.setSelectedTimeRange,
      props.setCurrentDate,
    ],
  );
}

/** Hook for period navigation with keyboard support (left/right arrows) */
function usePeriodNavigation(props: TodoFiltersProps) {
  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      props.setCurrentDate(navigatePeriod(props.currentDate, props.selectedTimeRange, direction));
    },
    [props.currentDate, props.selectedTimeRange, props.setCurrentDate],
  );

  useDateNavigationKeys({ timeRange: props.selectedTimeRange, onNavigate: handleNavigate });

  return handleNavigate;
}

interface TopBarProps {
  currentDate: Date;
  selectedTimeRange: TodoFiltersProps['selectedTimeRange'];
  isViewPrefsLoading?: boolean;
  tableColumns: string[];
  viewMode: ViewMode;
  onNavigate: (direction: 'prev' | 'next') => void;
  onReset: () => void;
  onTableColumnsChange: TodoFiltersProps['onTableColumnsChange'];
  onViewModeChange: TodoFiltersProps['onViewModeChange'];
}

/** Top bar with Add todo (left on mobile) + Date nav + settings (right) */
const TopBar: FC<TopBarProps> = (props) => {
  const isXl = useMediaQuery('(min-width: 1280px)');

  return (
    <div className="order-1 flex w-full items-center gap-2 xl:order-2 xl:ml-auto xl:w-auto">
      <div className="xl:hidden">
        <AddTodoPopover enableKeyboardShortcut={!isXl} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <PeriodNavigation
          currentDate={props.currentDate}
          onNavigate={props.onNavigate}
          onReset={props.onReset}
          selectedTimeRange={props.selectedTimeRange}
        />
        <ViewSettingsPopover
          isLoading={props.isViewPrefsLoading}
          onTableColumnsChange={props.onTableColumnsChange}
          onViewModeChange={props.onViewModeChange}
          tableColumns={props.tableColumns}
          viewMode={props.viewMode}
        />
      </div>
    </div>
  );
};

export const TodoFilters: FC<TodoFiltersProps> = (props) => {
  const { allTags } = useTags();
  const { allContexts } = useEddoContexts();
  const handleApplyPreset = useApplyPresetHandler(props);
  const handleNavigate = usePeriodNavigation(props);

  return (
    <div className="flex flex-col gap-2 bg-white pb-3 xl:flex-row xl:flex-wrap xl:items-center dark:bg-neutral-800">
      <div className="order-2 flex flex-wrap items-center gap-2 xl:order-1">
        <FilterRow
          allContexts={allContexts}
          allTags={allTags}
          currentDate={props.currentDate}
          isViewPrefsLoading={props.isViewPrefsLoading ?? false}
          onApplyPreset={handleApplyPreset}
          onTableColumnsChange={props.onTableColumnsChange}
          onViewModeChange={props.onViewModeChange}
          selectedContexts={props.selectedContexts}
          selectedStatus={props.selectedStatus}
          selectedTags={props.selectedTags}
          selectedTimeRange={props.selectedTimeRange}
          selectedTimeTracking={props.selectedTimeTracking}
          setSelectedContexts={props.setSelectedContexts}
          setSelectedStatus={props.setSelectedStatus}
          setSelectedTags={props.setSelectedTags}
          setSelectedTimeRange={props.setSelectedTimeRange}
          setSelectedTimeTracking={props.setSelectedTimeTracking}
          tableColumns={props.tableColumns}
          viewMode={props.viewMode}
        />
      </div>
      <TopBar
        currentDate={props.currentDate}
        isViewPrefsLoading={props.isViewPrefsLoading}
        onNavigate={handleNavigate}
        onReset={() => props.setCurrentDate(new Date())}
        onTableColumnsChange={props.onTableColumnsChange}
        onViewModeChange={props.onViewModeChange}
        selectedTimeRange={props.selectedTimeRange}
        tableColumns={props.tableColumns}
        viewMode={props.viewMode}
      />
    </div>
  );
};
