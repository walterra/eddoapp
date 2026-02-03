/**
 * Filter row component with all filter dropdowns
 */
import type { FC } from 'react';

import { AddTodoPopover } from './add_todo_popover';
import { EddoContextFilter } from './eddo_context_filter';
import { PresetFilterDropdown } from './preset_filter_dropdown';
import { StatusFilter } from './status_filter';
import { TagFilter } from './tag_filter';
import { TimeRangeFilter } from './time_range_filter';
import type { FilterRowProps } from './todo_filters_types';

export const FilterRow: FC<FilterRowProps> = (props) => (
  <>
    {/* AddTodoPopover shown here only on xl screens, otherwise in top bar */}
    <div className="hidden xl:block">
      <AddTodoPopover />
    </div>
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
