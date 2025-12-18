# Put add-todo and filters-section on separate rows

**Status:** In Progress
**Created:** 2025-12-18-22-40-40
**Started:** 2025-12-18-22-42-08
**Agent PID:** 98482

## Description

Restructure the AddTodo component layout to display the add-todo form inputs and filter controls on separate rows instead of a single row. This improves visual hierarchy and makes the UI more organized.

**Current:** Single row with form inputs on left and filters on right (responsive flex layout)  
**New:** Two separate rows - form inputs on top, filters on bottom

**Success Criteria:**

- Add-todo form inputs (context, title, link, tags, due date, submit button) display in first row
- Filter controls (time range, status, context, tag filters + navigation) display in second row
- Both rows maintain responsive behavior
- No visual regressions in spacing, alignment, or styling
- Existing functionality remains unchanged (filters still work, todos can be added)

## Implementation Plan

- [x] Split the single flex container into two separate rows in `packages/web-client/src/components/add_todo.tsx` (lines 206-273)
- [x] Ensure both rows maintain appropriate spacing and responsive behavior
- [x] Verify existing tests still pass
- [x] Manual testing: Add todo with various inputs, use all filter controls
- [x] Visual verification: Check layout on mobile and desktop viewports

## Review

- [x] **Mobile Responsive Behavior**: Filters now always visible on all screen sizes (decision: keep this behavior)
- [x] **Code Organization**: Extracted filters into separate `todo_filters.tsx` component for better separation of concerns
- [x] **Test Coverage**: Created `todo_filters.test.tsx` with 5 tests covering rendering and navigation

## Notes

**Phase 1: Initial Separation (within add_todo.tsx):**

- Split single flex container into two separate rows
- Row 1: Add-todo form inputs with flex layout and divide-x borders
- Row 2: Filter controls with flex layout and space-x-3 spacing
- Removed responsive sm:flex classes from filters (now always visible)

**Phase 2: Component Extraction (better separation of concerns):**

- Created new `todo_filters.tsx` component with all filter logic
- Refactored `add_todo.tsx` to only handle add-todo form
- Updated `eddo.tsx` to render both components separately
- Moved filter-related functions: getPeriodLabel, previousPeriodClickHandler, nextPeriodClickHandler
- Moved filter-related state management to parent (already in eddo.tsx)

**Test Updates:**

- Removed 2 filter-related tests from add_todo.test.tsx
- Created todo_filters.test.tsx with 5 new tests
- Updated add_todo.test.tsx to remove defaultProps (no longer needed)
- Final test count: 390 tests passed (18 for AddTodo, 5 for TodoFilters)

**Visual Polish:**

- Removed border-b from add_todo.tsx to eliminate line between rows
- Removed divide-x borders between form inputs for cleaner look
- Replaced pr-3 wrapper divs with space-x-3 spacing on parent
- Creates unified visual section with single bottom border on filters
- Simplified filter labels for cleaner UI:
  - "Current week" → "Week", "Current day" → "Day", "Current month" → "Month", "Current year" → "Year"
  - "Filter by context" → "Context"
  - "Filter by tags" → "Tags"
  - "All todos" → "All", "Incomplete only" → "Incomplete", "Completed only" → "Completed"

**Files Changed:**

- Created: packages/web-client/src/components/todo_filters.tsx
- Created: packages/web-client/src/components/todo_filters.test.tsx
- Modified: packages/web-client/src/components/add_todo.tsx (simplified, ~50% smaller)
- Modified: packages/web-client/src/components/add_todo.test.tsx (removed filter tests)
- Modified: packages/web-client/src/eddo.tsx (added TodoFilters import and render)
- Modified: packages/web-client/src/components/time_range_filter.tsx (simplified labels)
- Modified: packages/web-client/src/components/eddo_context_filter.tsx (simplified labels)
- Modified: packages/web-client/src/components/tag_filter.tsx (simplified labels)
- Modified: packages/web-client/src/components/tag_filter.test.tsx (updated for new labels)
- Modified: packages/web-client/src/components/status_filter.tsx (simplified labels)
