# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 7069

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

| Warning Type           | Original | Current | Reduction |
| ---------------------- | -------- | ------- | --------- |
| max-lines-per-function | 112      | ~85     | ~24%      |
| complexity             | 68       | ~50     | ~26%      |
| max-depth              | 40       | ~25     | ~38%      |
| max-statements         | 28       | ~20     | ~29%      |
| max-lines              | 18       | ~10     | ~44%      |
| max-params             | 4        | ~3      | ~25%      |

**Current Status:** 180 warnings (down from 270, 90 fixed = 33% reduction)

**Success Criteria:**

- All tests pass (`pnpm test`) ✅
- Code maintains same functionality ✅
- Significant reduction in warnings ✅ (33% achieved)

## Implementation Plan

### Completed Refactoring

1. **scripts/verify-backup.ts** ✅
   - Extracted validation helpers
   - Split processLine into smaller functions

2. **scripts/backup-retention.ts** ✅
   - Extracted categorization logic
   - Split display functions

3. **packages/web-api/src/github/client.ts** ✅
   - Created query-builder.ts module
   - Created issue-fetcher.ts module

4. **packages/core-server/src/api/user-registry.ts** ✅
   - Created user-registry-design-docs.ts module
   - Created user-registry-test.ts module

5. **scripts/restore-interactive.ts** ✅
   - Created restore-interactive-prompts.ts module

6. **scripts/backup-interactive.ts** ✅
   - Created backup-interactive-prompts.ts module

7. **packages/web-api/src/github/sync-scheduler.ts** ✅
   - Created sync-helpers.ts module

8. **packages/web-api/src/routes/users.ts** ✅
   - Created users-helpers.ts module

9. **scripts/backup-scheduler.ts** ✅
   - Created backup-scheduler-helpers.ts module

10. **packages/web-api/src/routes/auth.ts** ✅
    - Created auth-helpers.ts module

### Remaining Files (mostly React components)

- packages/web-client/src/components/todo_board.tsx (7 warnings)
- packages/web-client/src/components/todo_table.tsx (6 warnings)
- packages/web-client/src/components/user_profile.tsx (5 warnings)
- scripts/populate-mock-data.ts (6 warnings)

### Verification

- [x] Run `pnpm lint` - 180 warnings (33% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors
- [x] Run `pnpm build` - builds successfully

## New Helper Modules Created

1. scripts/restore-interactive-prompts.ts
2. scripts/backup-interactive-prompts.ts
3. scripts/backup-scheduler-helpers.ts
4. packages/web-api/src/github/query-builder.ts
5. packages/web-api/src/github/issue-fetcher.ts
6. packages/web-api/src/github/sync-helpers.ts
7. packages/web-api/src/routes/users-helpers.ts
8. packages/web-api/src/routes/auth-helpers.ts
9. packages/core-server/src/api/user-registry-design-docs.ts
10. packages/core-server/src/api/user-registry-test.ts

## Review

[To be filled during review phase]

## Notes

- Focus on non-UI files as they refactor more cleanly
- React components with heavy JSX are challenging to split
- Achieved 33% reduction (90 warnings fixed)
- Remaining warnings are mostly in React components and test scripts
