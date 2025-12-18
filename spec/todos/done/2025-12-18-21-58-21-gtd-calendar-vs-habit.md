# Distinguish between gtd:calendar and gtd:habit for repeated todos

**Status:** Done
**Created:** 2025-12-18-21-58-21
**Started:** 2025-12-18-22-00-36
**Agent PID:** 98482

## Description

Implement tag-based repeat behavior for todos:

- **gtd:calendar** - Repeat from the original due date (e.g., monthly bills always due on the 15th)
- **gtd:habit** - Repeat from the completion date (e.g., exercise every 3 days from when you last did it)

Currently, ALL repeated todos use completion date as the base. This causes calendar-based todos (appointments, recurring bills, etc.) to drift over time.

**Success criteria:**

1. Todo with `gtd:calendar` tag + repeat=7 completed on Jan 15 with due=Jan 10 → new todo due=Jan 17 (7 days from Jan 10)
2. Todo with `gtd:habit` tag + repeat=3 completed on Jan 15 with due=Jan 10 → new todo due=Jan 18 (3 days from Jan 15)
3. Todo with neither tag + repeat=5 → defaults to habit behavior (from completion date)
4. All existing tests pass, new behavior is tested

## Implementation Plan

- [x] Update `getRepeatTodo` function to check for gtd:calendar vs gtd:habit tags (packages/core-shared/src/utils/get_repeat_todo.ts)
- [x] Add comprehensive unit tests for getRepeatTodo covering all scenarios (packages/core-shared/src/utils/get_repeat_todo.test.ts)
- [x] Automated test: `pnpm test get_repeat_todo.test.ts`
- [x] User test:
  1. Create todo with gtd:calendar tag, due tomorrow, repeat=7
  2. Complete it today
  3. Verify new todo is due 7 days from tomorrow (not 7 days from today)
  4. Create todo with gtd:habit tag, due yesterday, repeat=3
  5. Complete it today
  6. Verify new todo is due 3 days from today

## Review

- [x] MCP server has duplicate repeat logic in completeTodo tool (packages/mcp_server/src/mcp-server.ts:~line with "Handle repeating todos") - should use getRepeatTodo() instead
- [x] MCP server's repeat field description needs updating to mention gtd:calendar vs gtd:habit behavior (packages/mcp_server/src/mcp-server.ts:~line "Number of days to repeat")

## Notes

**Implementation Details:**

- Modified `getRepeatTodo()` to check for `gtd:calendar` tag and use original due date as base
- For `gtd:habit` tag or no tag, uses completion date as base (maintaining backward compatibility)
- Implemented UTC-aware date parsing to avoid timezone issues
- When both tags present, `gtd:calendar` takes precedence

**Fixed Issues:**

- MCP server had duplicate repeat logic that didn't respect tag-based behavior
- Now uses centralized `getRepeatTodo()` function across all components
- Updated MCP tool descriptions to document new behavior

**Test Coverage:**

- 12 comprehensive unit tests covering all scenarios
- All existing integration tests pass
- Manual testing confirmed correct behavior in UI
