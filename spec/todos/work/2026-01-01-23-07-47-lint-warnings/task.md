# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 7069

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

| Warning Type           | Original | Current | Description                    |
| ---------------------- | -------- | ------- | ------------------------------ |
| max-lines-per-function | 112      | ~90     | Functions exceeding 50 lines   |
| complexity             | 68       | ~55     | Cyclomatic complexity > 10     |
| max-depth              | 40       | ~30     | Nesting > 3 levels deep        |
| max-statements         | 28       | ~22     | Functions with > 30 statements |
| max-lines              | 18       | ~12     | Files exceeding 300 lines      |
| max-params             | 4        | ~4      | Functions with > 4 parameters  |

**Current Status:** 193 warnings (down from 270, 77 fixed)

**Success Criteria:**

- All tests pass (`pnpm test`)
- Code maintains same functionality
- Significant reduction in warnings

## Implementation Plan

### Completed Refactoring

1. **scripts/verify-backup.ts** (12 → 0 warnings) ✅
   - Extracted validation helpers
   - Split processLine into smaller functions
   - Reduced nesting depth

2. **scripts/backup-retention.ts** (10 → 0 warnings) ✅
   - Extracted categorization logic
   - Split display functions
   - Reduced file size

3. **packages/web-api/src/github/client.ts** (9 → 0 warnings) ✅
   - Created query-builder.ts module
   - Created issue-fetcher.ts module
   - Simplified main client

4. **packages/core-server/src/api/user-registry.ts** (9 → 0 warnings) ✅
   - Created user-registry-design-docs.ts module
   - Created user-registry-test.ts module
   - Reduced file size below 300 lines

5. **scripts/restore-interactive.ts** (8 → 0 warnings) ✅
   - Created restore-interactive-prompts.ts module
   - Extracted config collection logic
   - Reduced complexity

6. **scripts/backup-interactive.ts** (7 → 0 warnings) ✅
   - Created backup-interactive-prompts.ts module
   - Extracted prompt creation logic
   - Updated tests to match new structure

7. **packages/web-api/src/github/sync-scheduler.ts** (6 → 0 warnings) ✅
   - Created sync-helpers.ts module
   - Extracted processIssue logic
   - Reduced class method complexity

### Remaining High-Impact Files

- packages/web-client/src/components/todo_board.tsx (7 warnings)
- scripts/populate-mock-data.ts (6 warnings)
- scripts/backup-scheduler.ts (6 warnings)
- packages/web-client/src/database_setup.ts (6 warnings)
- packages/web-client/src/components/todo_table.tsx (6 warnings)
- packages/web-api/src/routes/users.ts (6 warnings)

### Verification

- [ ] Run `pnpm lint` - reduce to under 200 warnings (currently 193 ✅)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors
- [x] Run `pnpm build` - builds successfully

## Review

[To be filled during review phase]

## Notes

- All issues are warnings (not errors)
- Focus on non-UI files first as they refactor more cleanly
- React components with heavy JSX are challenging to split without creating more files
- Created 8 new helper modules to reduce complexity:
  - scripts/restore-interactive-prompts.ts
  - scripts/backup-interactive-prompts.ts
  - packages/web-api/src/github/query-builder.ts
  - packages/web-api/src/github/issue-fetcher.ts
  - packages/web-api/src/github/sync-helpers.ts
  - packages/core-server/src/api/user-registry-design-docs.ts
  - packages/core-server/src/api/user-registry-test.ts
