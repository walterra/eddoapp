# Table View Date Filtering and Time Tracking Bugs in Day Mode

**Status:** In Progress
**Created:** 2025-12-21-08-56-06
**Started:** 2025-12-21-09-00-15
**Agent PID:** 98482

## Description

**What we're building:**
Fix bug in table view where TIME TRACKED column shows wrong date's duration (shows todo.due instead of currentDate). Date filtering already works correctly with CEST hack - keep it consistent with todo_board.tsx.

**The Bug: Time Tracking Display**

_Current behavior:_
TIME TRACKED column shows duration for each todo's **due date**, not the **currently viewed date**.

_Root cause:_
Line 538 passes `format(new Date(todo.due), 'yyyy-MM-dd')` as activeDate prop. Should use currentDate like board does.

Example from screenshot:

- Viewing Dec 20, 2025 (in date selector)
- Todos shown have due date Dec 21 (due to CEST +2h offset)
- Time tracked shown is for Dec 21 ❌ instead of Dec 20 ✅

**Source of truth: todo_board.tsx**

- Uses same `add({ hours: 2 })` pattern for date boundaries (keep this)
- Uses `.split('T')[0]` for date parsing (brittle but consistent)
- Passes `displayDate` (the grouped date) as activeDate prop
- We mirror this pattern in table view

**How we'll know it works:**

- TIME TRACKED column shows time logged on currently viewed date
- Behavior matches Kanban view (todo_board.tsx)
- Existing tests pass

## Implementation Plan

- [x] Fix activeDate prop to use currentDate (packages/web-client/src/components/todo_table.tsx:538)
  - Change FROM: `activeDate={format(new Date(todo.due), 'yyyy-MM-dd')}`
  - Change TO: `activeDate={format(currentDate, 'yyyy-MM-dd')}`
  - This mirrors todo_board.tsx behavior (line 427: uses displayDate from grouping)
- [x] Fix due date display to use brittle parsing (packages/web-client/src/components/todo_table.tsx:206)
  - Change FROM: `{format(new Date(todo.due), 'yyyy-MM-dd')}`
  - Change TO: `{todo.due.split('T')[0]}`
  - Matches todo_board.tsx pattern (line 312: uses .split('T')[0])
- [x] Run lint/format: `pnpm lint && pnpm format`
- [x] Run tests: `pnpm vitest:run packages/web-client/src/components/todo_table.test.tsx`
- [ ] User test: View Day mode, start time tracking on a todo, verify:
  - TIME TRACKED column shows duration for currently viewed date
  - Matches behavior of Kanban view

## Review

- [ ] Verify date boundary logic matches todo_board.tsx (should already match)
- [ ] Document that proper timezone fix is a separate todo

## Notes

**Investigation findings:**

- todo_board.tsx is source of truth - uses `add({ hours: 2 })` CEST hack (keep this)
- todo_board.tsx uses `.split('T')[0]` for brittle date parsing (keep consistent)
- todo_board.tsx passes `displayDate` (grouped date) as activeDate prop (line 427)
- todo_table.tsx incorrectly passes `format(new Date(todo.due), ...)` as activeDate (line 538)
- `getActiveDuration` filters time entries by activeDate parameter - gets wrong date's data
- Proper timezone fix is separate todo item

**User-provided screenshot evidence:**

- Viewing Dec 20, 2025 in Day mode (date selector shows "Dec 20, 2025")
- DUE DATE column shows "2025-12-21" (expected with CEST +2h offset)
- TIME TRACKED column shows "-" (bug: checking Dec 21 data instead of Dec 20)
- Section header shows "4h 47m" total (context-level aggregation works)
- Proves activeDate is using wrong date (todo.due instead of currentDate)

**Implementation completed:**

- Changed line 538: `activeDate={format(currentDate, 'yyyy-MM-dd')}` (TIME TRACKED fix)
- Changed line 206: `{todo.due.split('T')[0]}` (DUE DATE display fix)
- Both changes match todo_board.tsx patterns (brittle parsing for consistency)
- Lint passed (only pre-existing warnings)
- Format passed (all files unchanged)
- All 9 tests passed in todo_table.test.tsx

**User validation:**

- First screenshot: TIME TRACKED showed "-" (bug)
- Second screenshot: TIME TRACKED shows "5s" (fixed ✅)
- Second screenshot revealed DUE DATE showing "2025-12-22" instead of "2025-12-21"
- Applied second fix using `.split('T')[0]` pattern from board
