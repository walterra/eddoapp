/**
 * Todo filters toolbar component
 */
import { type FC, useCallback } from 'react';

import { useDateNavigationKeys } from '../hooks/use_date_navigation_keys';
import { useEddoContexts } from '../hooks/use_eddo_contexts';
import type { CurrentFilterState } from '../hooks/use_filter_presets';
import { useTags } from '../hooks/use_tags';

import { navigatePeriod } from './todo_filters_helpers';
import { PeriodNavigation } from './todo_filters_navigation';
import { FilterRow } from './todo_filters_row';
import type { TodoFiltersProps } from './todo_filters_types';
import { ViewSettingsPopover } from './view_settings_popover';

export type { CompletionStatus } from './status_filter';
export type { TimeRange } from './time_range_filter';
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
          selectedTimeRange: filters.selectedTimeRange,
          currentDate: filters.currentDate,
        });
      } else {
        props.setSelectedTags(filters.selectedTags);
        props.setSelectedContexts(filters.selectedContexts);
        props.setSelectedStatus(filters.selectedStatus);
        props.setSelectedTimeRange(filters.selectedTimeRange);
        props.setCurrentDate(filters.currentDate);
      }
    },
    [
      props.batchUpdateFilters,
      props.setSelectedTags,
      props.setSelectedContexts,
      props.setSelectedStatus,
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

export const TodoFilters: FC<TodoFiltersProps> = (props) => {
  const { allTags } = useTags();
  const { allContexts } = useEddoContexts();
  const handleApplyPreset = useApplyPresetHandler(props);
  const handleNavigate = usePeriodNavigation(props);

  return (
    <div className="flex items-center justify-between bg-white pb-3 dark:bg-neutral-800">
      <div className="flex items-center space-x-2">
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
          setSelectedContexts={props.setSelectedContexts}
          setSelectedStatus={props.setSelectedStatus}
          setSelectedTags={props.setSelectedTags}
          setSelectedTimeRange={props.setSelectedTimeRange}
          tableColumns={props.tableColumns}
          viewMode={props.viewMode}
        />
      </div>
      <div className="flex items-center space-x-2">
        <PeriodNavigation
          currentDate={props.currentDate}
          onNavigate={handleNavigate}
          onReset={() => props.setCurrentDate(new Date())}
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
