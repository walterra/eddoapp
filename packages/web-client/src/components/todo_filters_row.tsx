/**
 * Filter row component with all filter dropdowns
 */
import type { FC } from 'react';

import { ColumnPicker } from './column_picker';
import { EddoContextFilter } from './eddo_context_filter';
import { PresetFilterDropdown } from './preset_filter_dropdown';
import { StatusFilter } from './status_filter';
import { TagFilter } from './tag_filter';
import { TimeRangeFilter } from './time_range_filter';
import type { FilterRowProps } from './todo_filters_types';
import { ViewModeToggle } from './view_mode_toggle';

export const FilterRow: FC<FilterRowProps> = (props) => (
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
    <PresetFilterDropdown
      currentFilters={{
        selectedTags: props.selectedTags,
        selectedContexts: props.selectedContexts,
        selectedStatus: props.selectedStatus,
        selectedTimeRange: props.selectedTimeRange,
        currentDate: props.currentDate,
      }}
      onApplyPreset={props.onApplyPreset}
    />
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
