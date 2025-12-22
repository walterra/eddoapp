# Fix filter dropdown cutoff when kanban/table is empty

**Status:** Done
**Created:** 2025-12-22-22-38-26
**Started:** 2025-12-22 22:44:02
**Agent PID:** 98482

## Description

Fix UI issue where filter dropdowns (Tags, Context, Status, TimeRange) are cut off when the kanban board or table has no items or minimal content. The dropdowns use absolute positioning (`absolute top-full`) and extend beyond the visible area when the page height is reduced.

**Success Criteria:**

- Filter dropdowns are fully visible and not cut off even when kanban/table is empty
- No visual regression for pages with normal content
- Dropdowns remain properly positioned and styled

## Implementation Plan

- [x] Fix root layout structure (packages/web-client/src/eddo.tsx & page_wrapper.tsx)
  - REVISED APPROACH: Moved min-h-screen to PageWrapper instead of eddo.tsx
  - PageWrapper now wraps content in `<div className="flex min-h-screen w-full flex-col">`
  - Removed Fragment, made PageWrapper return proper flex container
  - This ensures footer and main content are direct children of flex container
- [x] Update PageWrapper layout to work with new structure (packages/web-client/src/components/page_wrapper.tsx)
  - Changed from Fragment to flex container wrapper
  - Main content div uses `flex-1` to fill available space
  - Footer uses `mt-auto` to stick to bottom (now works because it's in flex container)
- [x] Add CSS for html/body to ensure full height (packages/web-client/src/eddo.css)
  - Added `html, body, #root { height: 100%; }` for proper layout hierarchy
- [x] Verify footer positioning (packages/web-client/src/components/page_wrapper.tsx)
  - Footer is now direct child of flex container with mt-auto
  - Will stick to bottom when content is minimal, stay below content when scrolling needed
- [x] Add max-height and internal scrolling to all dropdowns
  - Updated tag_filter.tsx, eddo_context_filter.tsx, status_filter.tsx
  - Updated time_range_filter.tsx, column_picker.tsx, tag_input.tsx
  - Added `max-h-96 overflow-y-auto` (384px max height with internal scroll)
  - Prevents dropdowns from extending beyond viewport, shows scrollbar when needed
- [x] Test with empty kanban board
  - Open all filter dropdowns (Tags, Context, Status, TimeRange, ColumnPicker)
  - Verify none are cut off
  - Verify long lists scroll internally instead of extending
- [x] Test with empty table view
  - Switch to table view with no data
  - Open all filter dropdowns, verify visibility and scrolling
- [x] Test with populated data
  - Verify no visual regression
  - Check that dropdowns with many items scroll properly
  - Verify dark mode compatibility
- [x] Test responsive behavior
  - Mobile viewport (sm breakpoint)
  - Tablet viewport
  - Desktop viewport
- [x] Automated test: Update existing component tests if needed to account for layout changes
  - All unit tests passing (460 passed, 2 skipped)
- [x] User test: Verify dropdowns work correctly in both empty and populated states across viewports
  - User confirmed all working correctly

## Review

- [x] Check for any overflow issues in other parts of the UI
  - Middle container has `overflow-hidden` which is intentional for layout
  - Main has `overflow-auto` which allows scrolling of main content
  - Dropdowns are absolutely positioned from within main, work correctly
  - No clipping issues observed
- [x] Verify responsive behavior on different screen sizes
  - sm breakpoint changes flex-row behavior
  - Layout works on mobile, tablet, desktop
  - Footer positioning correct across viewports
- [x] Ensure accessibility (keyboard navigation, screen readers)
  - Scrollable regions have proper overflow behavior
  - All existing ARIA labels preserved
  - No new accessibility issues introduced
- [x] Run production build
  - Build succeeds with no errors
  - Only expected chunking warning (pre-existing)

## Notes

**Root Cause:**
The layout hierarchy lacks a viewport-height root constraint:

```
<div id="root">           <!-- No height -->
  <QueryClientProvider>   <!-- No height -->
    <AuthenticatedApp>    <!-- No height -->
      <PageWrapper>       <!-- flex-grow doesn't work without parent height! -->
        <main h-full>     <!-- h-full of nothing = shrinks to content -->
```

Without a height-constrained parent, `flex-grow` and `h-full` have no reference and collapse to content size. When content is minimal, the main element shrinks and dropdowns get cut off.

**Proper Solution:**
Establish viewport height at the root of the app tree:

1. Wrap AuthenticatedApp return in `min-h-screen flex flex-col` container
2. This gives PageWrapper's flex-grow a proper height reference
3. Main element's h-full now has stable height even with minimal content
4. Dropdowns have consistent space regardless of content amount

**Why This Is Better Than min-height on main:**

- Not brittle - works with dynamic dropdown heights
- Follows proper flexbox patterns - parent defines constraints, children flex within them
- Scalable - works across all viewport sizes
- Semantic - the app container should define app height, not individual components

**Alternative Solutions Considered:**

1. Portal-based dropdowns (e.g., Radix UI) - over-engineering, adds dependency
2. Fixed positioning for dropdowns - requires position calculations, more complex
3. Min-height on main element - brittle, doesn't address root cause
4. Proper layout structure (chosen) - fixes root cause, follows best practices

**Final Structure:**

```
html, body, #root { height: 100% }
  └─ PageWrapper <div className="flex min-h-screen w-full flex-col">
      ├─ Main content area <div className="flex-1 overflow-auto">
      │   └─ TodoFilters (dropdowns: max-h-96 overflow-y-auto)
      │   └─ TodoBoard/TodoTable
      └─ Footer <footer className="mt-auto">
```

The min-h-screen ensures the container is always at least viewport height, even when content is minimal. The flex-1 on main content allows it to grow/shrink as needed. The mt-auto on footer pushes it to the bottom when there's extra space.

**Dropdown Improvements:**

- Added `max-h-96` (384px) to all filter dropdowns
- Added `overflow-y-auto` for internal scrolling when content exceeds max height
- Prevents massive dropdowns from extending beyond fold
- Applies to: TagFilter, EddoContextFilter, StatusFilter, TimeRangeFilter, ColumnPicker, TagInput
