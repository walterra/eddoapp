# Add consistent hover/focus states to all interactive elements

**Status:** Done
**Started:** 2026-01-02-23-20
**Created:** 2026-01-02-23-16-46
**Agent PID:** 34113
**GitHub Issue:** [#353](https://github.com/walterra/eddoapp/issues/353)

## Description

Audit and standardize hover/focus states across all interactive elements in the web-client to ensure every interaction provides visual feedback. Currently, interactive states are inconsistent:

- Some buttons have hover states, others don't
- Focus states (for keyboard navigation) are missing or inconsistent
- Transition durations vary
- Dark mode hover states need verification

**Success Criteria:**

- All buttons, links, and clickable elements have visible hover states
- All focusable elements have visible focus rings/outlines
- Transitions are consistent (200ms as per design principles)
- Both light and dark mode states work correctly
- Accessibility improved for keyboard navigation

## Audit Findings

### Components with Good States ✅

- `toggle_switch.tsx` - Has hover, focus ring, and disabled states
- `view_mode_toggle.tsx` - Has hover states and transition-colors
- `todo_list_element.tsx` - Has `hover:text-gray-600` on action buttons
- `login.tsx` - Uses Flowbite components which have states

### Components Needing Improvement ⚠️

1. **Filter Dropdowns** (tag_filter, status_filter, eddo_context_filter, time_range_filter, column_picker):
   - Missing: `focus:outline-none focus:ring-2 focus:ring-blue-500`
   - Inconsistent transition classes

2. **Todo Cards** (todo_list_element.tsx):
   - Card container missing hover state for the whole card
   - Action buttons appear on hover but no focus state

3. **Table Row Actions** (todo_table_row.tsx):
   - `hover:bg-gray-100` present but no focus ring

4. **Period Navigation** (todo_filters.tsx):
   - Period label button missing focus states

5. **Links** (various):
   - Some links have `hover:underline`, others don't
   - Missing focus states on text links

6. **Form Inputs** (add_todo, time_range_filter DateInput):
   - Custom date inputs in time_range_filter missing focus ring

## Implementation Plan

### Create Shared Button Styles

- [x] Create `packages/web-client/src/styles/interactive.ts` with reusable class constants

### Update Filter Components

- [x] Update `tag_filter.tsx` - Add focus states to trigger button and list items
- [x] Update `status_filter.tsx` - Add focus states to trigger button and options
- [x] Update `eddo_context_filter.tsx` - Add focus states to trigger button and list items
- [x] Update `time_range_filter.tsx` - Add focus states to trigger button, options, and date inputs
- [x] Update `column_picker.tsx` - Add focus states to trigger button

### Update Todo Components

- [x] Update `todo_list_element.tsx` - Add card hover state, focus states on action buttons
- [x] Update `todo_table_row.tsx` - Add focus states on action buttons

### Update Navigation/Controls

- [x] Update `todo_filters.tsx` - Add focus state to period navigation button

### Testing

- [x] Manual test: Tab through all interactive elements in light mode
- [x] Manual test: Tab through all interactive elements in dark mode
- [x] User test: Verify visual consistency and keyboard accessibility

## Review

- [x] No bugs found - all tests pass, lint clean, types check

## Notes

- Design principles specify 200-300ms for UI transitions
- Focus states should use `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
- Dark mode offset: `dark:focus:ring-offset-gray-800`
- Flowbite components (Button, TextInput, Checkbox) already have proper focus states
- Created centralized `interactive.ts` style constants for DRY and consistency
- Used `FOCUS_RING_INSET` for dropdown items (no offset needed inside dropdowns)
- Added card hover effect with shadow for todo cards
- All filter components now share the same button/dropdown styles
