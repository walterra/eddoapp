# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 7069

## Description

The codebase has 270 ESLint warnings across multiple files. All warnings are code quality warnings (not errors) related to function complexity and size:

| Warning Type           | Count | Description                    |
| ---------------------- | ----- | ------------------------------ |
| max-lines-per-function | 112   | Functions exceeding 50 lines   |
| complexity             | 68    | Cyclomatic complexity > 10     |
| max-depth              | 40    | Nesting > 3 levels deep        |
| max-statements         | 28    | Functions with > 30 statements |
| max-lines              | 18    | Files exceeding 300 lines      |
| max-params             | 4     | Functions with > 4 parameters  |

**Success Criteria:**

- Run `pnpm lint` with 0 warnings
- All tests pass (`pnpm test`)
- Code maintains same functionality

## Implementation Plan

Given the large scope (270 warnings across 50+ files), this will require a phased approach focusing on the worst offenders first.

### Phase 1: Worst Offenders (Highest Impact Files)

These files have multiple severe violations and should be refactored first:

1. **packages/mcp_server/src/mcp-server.ts** (1086 lines, 15 warnings)
   - [ ] Split into multiple tool handler modules
   - [ ] Extract execute methods into separate files

2. **packages/web-client/src/components/user_profile.tsx** (789 lines, 5 warnings)
   - [ ] Split into smaller sub-components
   - [ ] Extract hooks and handlers

3. **packages/web-client/src/components/todo_table.tsx** (517 lines, 6 warnings)
   - [ ] Extract table row rendering
   - [ ] Separate sorting/filtering logic

4. **packages/telegram_bot/src/agent/simple-agent.ts** (493 lines, 7 warnings)
   - [ ] Extract agent loop logic into helper functions
   - [ ] Reduce nesting depth

5. **packages/web-client/src/components/todo_board.tsx** (392 lines, 6 warnings)
   - [ ] Extract column rendering
   - [ ] Separate drag-drop logic

### Phase 2: Medium Impact Files

Files with 3-5 warnings each - refactor by extracting helper functions.

### Phase 3: Low Impact Files

Files with 1-2 warnings - minor refactoring to reduce function size/complexity.

### Verification

- [ ] Run `pnpm lint` - 0 warnings
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm tsc:check` - no type errors
- [ ] Run `pnpm build` - builds successfully

## Review

[To be filled during review phase]

## Notes

- All 270 issues are warnings (not errors)
- The project coding guidelines specify max 50 lines per function, max 300 lines per file
- Focus on splitting functions, not disabling rules
- Some files like `mcp-server.ts` (1086 lines) need major restructuring
