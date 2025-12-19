# In the table view we want the complete checkbox to be the first column

**Status:** Done
**Created:** 2025-12-19-08-19-42
**Started:** 2025-12-19-14-58-01
**Agent PID:** 98482

## Description

**What we're building:**
Move the complete checkbox (status column) to always be the first column in the table view, regardless of where it appears in the user's column selection. The checkbox should be the leftmost column when visible, followed by other selected columns, with the Actions column always last.

**How we'll know it works:**

- Status column appears first in table when included in selectedColumns
- Other columns appear in their relative order after status
- Actions column remains last
- Column picker still allows showing/hiding status column
- All existing tests pass
- Visual inspection shows checkbox as first column

## Implementation Plan

- [x] Update `DEFAULT_TABLE_COLUMNS` to have status first (packages/web-client/src/hooks/use_view_preferences.ts:7)
- [x] Modify column rendering logic in TodoTable to always render status first (packages/web-client/src/components/todo_table.tsx:408-438)
- [x] Modify column rendering logic in TodoRow to match (packages/web-client/src/components/todo_table.tsx:263-270)
- [x] Update tests to verify status column is first (packages/web-client/src/components/todo_table.test.tsx)
- [x] Update status column width to w-10 (narrower, checkbox-sized)
- [x] Remove status column header text (empty string)
- [x] Right-align Actions column header and content
- [x] Update use_view_preferences test to match new default order
- [x] Automated test: Run `pnpm test:unit todo_table`
- [x] Automated test: Run `pnpm lint` and `pnpm lint:format`
- [x] User test: Start dev server, view table mode, verify checkbox is first column
- [x] User test: Toggle status column off/on via column picker, verify behavior
- [x] User test: Change column selection, verify status stays first when enabled

## Review

**Self-Assessment Findings:**

✅ **Edge Cases Verified:**

- Status column not in selectedColumns: Works correctly, no reordering occurs
- Status column is the only column: Works correctly, renders as only column
- Empty selectedColumns: Cannot happen due to column picker's "at least one column" constraint
- User toggles status on/off: Works correctly, reordering happens at render time

✅ **Performance:**

- `reorderColumnsWithStatusFirst()` is lightweight (filter + spread operation)
- Called on each render but negligible performance impact

✅ **Code Quality:**

- Helper function is pure and testable
- Separation of concerns: user preferences stored as-is, reordering only for display
- Consistent with existing patterns in the codebase

✅ **Accessibility:**

- Empty header for status column is semantically correct (checkbox is self-explanatory)
- Right-aligned actions column is a common pattern and accessible
- All interactive elements remain keyboard accessible

✅ **Tests:**

- All 422 unit tests pass (2 skipped)
- New test verifies column ordering logic
- Existing tests updated to reflect new behavior

**No issues found - ready for completion**

## Notes

**Implementation Details:**

- Created `reorderColumnsWithStatusFirst()` helper function that ensures status column is always rendered first when present in selectedColumns
- Applied reordering in both table header and row rendering
- Status column now has no header text (empty string) and narrower width (w-10 instead of w-20)
- Actions column header and buttons now right-aligned using `text-right` and `justify-end`
- Updated DEFAULT_TABLE_COLUMNS to ['status', 'title', 'due', 'tags', 'timeTracked']
- All tests pass including new test verifying column order
