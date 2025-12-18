# Feature: option to switch between kanban view and a table view

**Status:** In Progress
**Created:** 2025-12-18-23-14-48
**Started:** 2025-12-18-23-22-45
**Agent PID:** 98482

## Description

Add a table view option alongside the existing kanban board, inspired by Airtable/GitHub Projects. Users can toggle between views, customize visible columns, and maintain full feature parity (time tracking, inline edit, checkboxes). View preference and column selection are persisted in user settings. Default view is kanban.

**Success Criteria:**

- Toggle between kanban and table views from filters toolbar
- Table view groups todos by context (like kanban)
- Column picker dropdown to select visible columns
- All kanban features work in table view (edit, time tracking, complete, tags)
- View preference saved to user settings and persists across sessions
- Default view is kanban for new users
- Responsive design works on different screen sizes

## Implementation Plan

### 1. Backend: Extend User Preferences Schema

- [x] Add view preferences to UserPreferences interface (packages/core-shared/src/versions/user_registry_alpha2.ts:7-17)
  - Add `viewMode?: 'kanban' | 'table'`
  - Add `tableColumns?: string[]` for visible columns
- [x] Update createDefaultUserPreferences() to include defaults (packages/core-shared/src/versions/user_registry_alpha2.ts:31-40)
- [x] Update isUserRegistryEntryAlpha2 validation if needed

### 2. Frontend: View Preference Hook

- [x] Create useViewPreferences hook (packages/web-client/src/hooks/use_view_preferences.ts)
  - Get viewMode and tableColumns from profile
  - Update viewMode via updatePreferences API
  - Update tableColumns via updatePreferences API
  - Provide loading/error states

### 3. UI: View Toggle Component

- [x] Create ViewModeToggle component (packages/web-client/src/components/view_mode_toggle.tsx)
  - Icon toggle buttons for kanban/table (use react-icons: MdViewKanban, MdTableChart)
  - Highlight active view
  - Call updatePreferences on toggle
  - Show loading state during update

### 4. UI: Column Picker Component

- [x] Create ColumnPicker component (packages/web-client/src/components/column_picker.tsx)
  - Dropdown with checkboxes for each available column
  - Columns: Title, Context, Due Date, Tags, Time Tracked, Status, Completed Date, Repeat, Link, Description
  - Save selection to preferences on change
  - Only shown in table view mode
  - Follow pattern from status_filter.tsx

### 5. UI: Table View Component

- [x] Create TodoTable component (packages/web-client/src/components/todo_table.tsx)
  - Accept same props as TodoBoard (currentDate, selectedTags, selectedContexts, selectedStatus, selectedTimeRange)
  - Group by context like kanban (collapsible sections)
  - Render only selected columns from preferences
  - Responsive table layout with horizontal scroll on mobile
  - Show context headers with time totals
  - Support all kanban features:
    - Inline checkbox for completion
    - Time tracking play/pause buttons
    - Edit button to open TodoEditModal
    - Tag display
    - Links
- [x] Reuse existing components: TodoEditModal, TagDisplay, FormattedMessage
- [x] Share data fetching logic with TodoBoard (extract to hooks if needed)

### 6. Integration: Update Filters and Main App

- [x] Add ViewModeToggle to TodoFilters component (packages/web-client/src/components/todo_filters.tsx:140)
  - Position after time range filter
- [x] Add ColumnPicker to TodoFilters component (conditional on table mode)
- [x] Update eddo.tsx to conditionally render TodoBoard or TodoTable (packages/web-client/src/eddo.tsx:102-109)
  - Get viewMode from useViewPreferences
  - Render TodoTable when viewMode === 'table'
  - Pass same props to both components

### 7. Styling

- [x] Add table-specific styles to eddo.css if needed
- [x] Ensure dark mode support for all new components
- [x] Test responsive behavior on mobile/tablet/desktop

### 8. Testing

- [x] Automated test: ViewModeToggle component (packages/web-client/src/components/view_mode_toggle.test.tsx)
  - Renders both icon buttons
  - Highlights active view
  - Calls onViewChange when clicked
  - Shows loading state
- [x] Automated test: ColumnPicker component (packages/web-client/src/components/column_picker.test.tsx)
  - Renders all column options
  - Toggles column selection
  - Calls onChange with updated columns
  - Persists open/closed state
- [x] Automated test: TodoTable component (packages/web-client/src/components/todo_table.test.tsx)
  - Renders todos grouped by context
  - Shows only selected columns
  - Renders time tracking controls
  - Opens edit modal on edit button click
  - Filters by context, status, and tags
- [x] Automated test: useViewPreferences hook (packages/web-client/src/hooks/use_view_preferences.test.ts)
  - Returns current preferences
  - Updates viewMode
  - Updates tableColumns
  - Handles loading/error states
- [x] User test: Toggle between views and verify persistence
  - Start in kanban view (default)
  - Click table view toggle
  - Verify table view appears
  - Refresh page
  - Verify table view persists
  - Toggle back to kanban
  - Refresh page
  - Verify kanban persists
- [x] User test: Column picker functionality
  - Open column picker in table view
  - Deselect "Description" column
  - Verify description column disappears
  - Refresh page
  - Verify column selection persists
  - Reselect description
  - Verify column reappears
- [x] User test: Table view feature parity
  - In table view, complete a todo via checkbox
  - Start time tracking on a todo
  - Stop time tracking
  - Edit a todo (title, tags, dates)
  - Verify all changes saved correctly
  - Click a link on a todo
  - Verify link opens in new tab
- [x] User test: Responsive table view
  - Test on mobile (< 640px)
  - Test on tablet (640-1024px)
  - Test on desktop (> 1024px)
  - Verify horizontal scroll works on small screens
  - Verify table is readable at all sizes

## Review

- [ ] Check for duplicate code between TodoBoard and TodoTable
- [ ] Consider extracting shared filtering/grouping logic
- [ ] Verify all TypeScript types are properly defined
- [ ] Check accessibility (keyboard navigation, screen readers)
- [ ] Performance: table view with 100+ todos

## Notes

### Bug Fixes

**Toggle Button Not Working:**

- Issue: Server-side `updatePreferencesSchema` in `packages/web-api/src/routes/users.ts` didn't include `viewMode` and `tableColumns` fields
- Fix: Added `viewMode: z.enum(['kanban', 'table']).optional()` and `tableColumns: z.array(z.string()).optional()` to the schema
- Result: Preferences now save correctly and persist across sessions

**React Key Warning in TodoTable:**

- Issue: "Each child in a list should have a unique key prop" when rendering table cells
- Fix: Wrapped `renderCell(columnId)` in `<Fragment key={columnId}>` when mapping over selectedColumns in TodoRow
- Result: React warning eliminated

**Table Layout Improvements:**

- Removed redundant "Context" column from default table columns (already grouped by context)
- Added fixed column widths to prevent wrapping (due: w-32, tags: w-48, timeTracked: w-28, status: w-20, etc.)
- Added `whitespace-nowrap` to date and time columns
- Extracted `getColumnWidthClass` helper function to maintain consistency between headers and cells
- Updated default columns: `['title', 'due', 'tags', 'timeTracked', 'status']`

**Dense Data Grid Styling (Table View):**

- Reduced cell padding from `px-4 py-3` to `px-2 py-1` for compact rows
- Changed font size from `text-sm` to `text-xs` throughout table
- Reduced header padding from `px-4 py-3` to `px-2 py-1`
- Reduced context header spacing: `mb-6` → `mb-4`, `mb-2` → `mb-1`
- Changed context header from `text-base` to `text-xs uppercase tracking-wide`
- Reduced action button sizes from `1.3em` to `1.1em` and padding from `p-1` to `p-0.5`
- Reduced gap between action buttons from `gap-1` to `gap-0.5`
- Removed shadow from table containers (cleaner look)
- Changed rounded-lg to rounded for table containers

**Dense Kanban Styling (Kanban View):**

- TodoListElement card changes:
  - Adjusted card padding from `px-1 py-1` to `px-2 py-1` (slightly more padding for better readability)
  - Changed from shadow to border (`border border-gray-200`)
  - Changed from `rounded-lg` to `rounded`
  - Reduced card spacing from `mb-2` to `mb-1`
  - Changed title font from `text-sm` to `text-xs`
  - Main container: `items-start` instead of `items-center` (top-aligned layout)
  - Content spacing: `space-x-1` (balanced between checkbox and title)
  - Checkbox alignment: `-ml-1 mr-0.5` (negative left margin to align checkbox with top padding)
  - Tag spacing: `mt-1` (adequate space above tags)
  - Action buttons alignment: `-mr-0.5 -mt-0.5` (positioned in top-right to match checkbox in top-left)
  - Button container: `items-start` (align to top instead of center)
  - Button sizes: `1.3em` with `p-0.5` padding (matches checkbox size and padding)
  - Simplified hover states to text color change only
  - Removed focus ring styles (cleaner minimal look)
  - Button gap: `space-x-0.5 items-start` (tight spacing, top-aligned)
  - Changed error margin from `mb-2` to `mb-1` and padding to `py-1`
- TodoBoard column changes:
  - Reduced column width from `24rem` to `20rem` (eddo.css)
  - Changed context header: `pb-2 pt-2 text-xs uppercase tracking-wide` (more bottom padding)
  - Column spacing: `space-x-3` (better separation between columns)
  - Reduced column bottom margin from `mb-6` to `mb-4`
  - Reduced todo list spacing from `space-y-4` to `space-y-2`
  - Reduced todo list bottom margin from `mb-4` to `mb-2`
  - Date header styling: `mb-1 text-xs font-medium` (more space before todos)
  - Removed margins from date header elements (cleaner look)
  - Removed shadow from container
  - Removed margins from context header elements

### Current Implementation Details

**Kanban View (TodoBoard):**

- Groups todos by context → date
- Fixed column width: 24rem (`.eddo-w-kanban`)
- Uses hooks: useTodosByWeek, useActivitiesByWeek, useTimeTrackingActive
- Filters: tags, contexts, status, time ranges
- Features: checkboxes, time tracking, edit modal, tags, links

**User Preferences:**

- Stored server-side via `/api/users/preferences` endpoint
- Uses `useProfile` hook for CRUD operations
- Schema in `packages/core-shared/src/versions/user_registry_alpha2.ts`

**UI Patterns:**

- Filter components use custom dropdowns (no external library)
- Icons from react-icons (Bi*, Ri*, Md\* packages)
- Dark mode via Tailwind classes
- Flowbite-react for some components (Button, Checkbox)

**Related Todo:**

- Remove duplicate: "alternative layout option instead of the kanban board: condensed table, sections instead of boards"
