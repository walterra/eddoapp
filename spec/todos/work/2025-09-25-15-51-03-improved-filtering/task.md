# improved filtering: currently we enforce filtering by week and can do optional tag filtering. we need to support more filtering use cases, for example show all uncompleted todos without the weekly filtering. improve the filtering UI to be more flexible. weekly filter should still be the default.

**Status:** Refining
**Created:** 2025-09-25T15:51:03
**Agent PID:** 58737

## Description

Enhance the filtering system in the web UI to provide more flexible filtering options beyond the current weekly + tag combination. Currently, users are restricted to viewing todos within a specific week with optional tag filtering. The new system should:

1. **Maintain weekly filtering as the default** but allow users to opt-out when needed
2. **Add completion status filtering** (show all, completed only, incomplete only)
3. **Add context filtering** similar to the existing tag filter
4. **Add comprehensive time range options** (current week, current month, current year, all time, custom date range)
5. **Improve the filter UI** to accommodate multiple filter types in a cohesive interface
6. **Preserve existing functionality** - current weekly navigation and tag filtering should continue to work as expected

The goal is to transform the rigid "weekly + optional tags" system into a flexible multi-filter system where users can choose their preferred combination of filters while keeping the weekly view as the sensible default.

## Success Criteria

- [ ] **Functional**: Weekly filtering remains the default behavior on page load
- [ ] **Functional**: Users can toggle off weekly filtering to see "All time" view
- [ ] **Functional**: Completion status filter works (All/Complete/Incomplete options)
- [ ] **Functional**: Context filtering works similar to existing tag filtering
- [ ] **Functional**: All filter combinations work together (tags + context + status + time range)
- [ ] **Functional**: Existing weekly navigation controls continue to work when weekly filter is active
- [ ] **Functional**: Current tag filtering functionality is preserved and works with new filters
- [ ] **Quality**: All TypeScript type checks pass (`pnpm tsc:check`)
- [ ] **Quality**: All linting passes (`pnpm lint`)
- [ ] **Quality**: All existing tests continue to pass (`pnpm test`)
- [ ] **User validation**: Manual testing of all filter combinations in browser
- [ ] **User validation**: Verify weekly filter defaults to current week on fresh page load
- [ ] **User validation**: Confirm existing users' workflows are not disrupted

## Implementation Plan

### Code Modifications

- [ ] **Create useEddoContexts hook** (packages/web-client/src/hooks/use_eddo_contexts.ts) - Extract unique contexts from todos similar to use_tags.ts
- [ ] **Create EddoContextFilter component** (packages/web-client/src/components/eddo_context_filter.tsx) - Multi-select context dropdown following TagFilter pattern
- [ ] **Create StatusFilter component** (packages/web-client/src/components/status_filter.tsx) - Completion status filter (All/Complete/Incomplete)
- [ ] **Create TimeRangeFilter component** (packages/web-client/src/components/time_range_filter.tsx) - Time range dropdown with options: Current Week (default), Current Month, Current Year, All Time, Custom Range
- [ ] **Update todo_board.tsx query logic** - Replace hardcoded weekly query with flexible filtering system using Mango queries
- [ ] **Add filter state management** (packages/web-client/src/components/eddo.tsx) - New state for context, status, and time range filters
- [ ] **Update AddTodo component** (packages/web-client/src/components/add_todo.tsx) - Integrate new filter components into existing filter bar
- [ ] **Add database index** (packages/web-client/src/database_setup.ts) - Add version-context-completed-due-index for optimal multi-filter queries

### Automated Tests

- [ ] **Automated test: useEddoContexts hook** - Test context extraction from various todo datasets
- [ ] **Automated test: EddoContextFilter component** - Test multi-select behavior and state management
- [ ] **Automated test: StatusFilter component** - Test completion status filtering logic
- [ ] **Automated test: TimeRangeFilter component** - Test all time range options (week/month/year/all-time/custom)
- [ ] **Automated test: TodoBoard filtering logic** - Test all filter combinations work correctly
- [ ] **Automated test: Database queries** - Test flexible query generation with different filter combinations

### User Tests

- [ ] **User test: Default weekly behavior preserved** - Verify page loads with current week selected
- [ ] **User test: Time range options work** - Test current month, current year, all-time, and custom date range filtering
- [ ] **User test: Context filtering works** - Select contexts and verify correct todos shown
- [ ] **User test: Status filtering works** - Toggle completion status and verify filtering
- [ ] **User test: Combined filters work** - Test multiple filter combinations (e.g., work context + incomplete + current month)
- [ ] **User test: Weekly navigation integration** - Verify existing prev/next week buttons work when current week filter active
- [ ] **User test: Existing tag filtering preserved** - Verify tag filtering works with new filters

## Original Todo

improved filtering: currently we enforce filtering by week and can do optional tag filtering. we need to support more filtering use cases, for example show all uncompleted todos without the weekly filtering. improve the filtering UI to be more flexible. weekly filter should still be the default.