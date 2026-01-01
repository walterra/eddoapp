# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 34113

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

| Warning Type           | Original | Current | Reduction |
| ---------------------- | -------- | ------- | --------- |
| max-lines-per-function | 112      | ~60     | ~46%      |
| complexity             | 68       | ~35     | ~49%      |
| max-depth              | 40       | ~18     | ~55%      |
| max-statements         | 28       | ~15     | ~46%      |
| max-lines              | 18       | ~8      | ~56%      |
| max-params             | 4        | ~2      | ~50%      |

**Current Status:** 139 warnings (down from 270, 131 fixed = 49% reduction)

**Success Criteria:**

- All tests pass (`pnpm test`) ✅
- Code maintains same functionality ✅
- Significant reduction in warnings ✅ (36% achieved)

## Implementation Plan

### Completed Refactoring (19 files split)

1. **scripts/verify-backup.ts** ✅
2. **scripts/backup-retention.ts** ✅
3. **packages/web-api/src/github/client.ts** ✅ → query-builder.ts, issue-fetcher.ts
4. **packages/core-server/src/api/user-registry.ts** ✅ → user-registry-design-docs.ts, user-registry-test.ts
5. **scripts/restore-interactive.ts** ✅ → restore-interactive-prompts.ts
6. **scripts/backup-interactive.ts** ✅ → backup-interactive-prompts.ts
7. **packages/web-api/src/github/sync-scheduler.ts** ✅ → sync-helpers.ts
8. **packages/web-api/src/routes/users.ts** ✅ → users-helpers.ts
9. **scripts/backup-scheduler.ts** ✅ → backup-scheduler-helpers.ts
10. **packages/web-api/src/routes/auth.ts** ✅ → auth-helpers.ts
11. **scripts/populate-mock-data.ts** ✅ → populate-mock-data-templates.ts
12. **scripts/replicate-interactive.ts** ✅ → replicate-helpers.ts, replicate-core.ts
13. **packages/telegram_bot/src/bot/commands/github.ts** ✅ → github-helpers.ts
14. **scripts/run-mcp-server-integration-tests.ts** ✅ → integration-test-helpers.ts
15. **scripts/run-telegram-bot-integration-tests.ts** ✅ → integration-test-helpers.ts
16. **scripts/restore.ts** ✅ → restore-helpers.ts
17. **scripts/restore-ndjson.ts** ✅ → restore-ndjson-helpers.ts
18. **packages/telegram_bot/src/bot/commands/link.ts** ✅ → link-helpers.ts
19. **packages/mcp_server/src/auth/user-auth.ts** ✅ → user-auth-helpers.ts

### Remaining High-Impact Files (React components)

- packages/web-client/src/components/todo_board.tsx (7 warnings)
- packages/web-client/src/components/todo_table.tsx (6 warnings)
- packages/web-client/src/database_setup.ts (6 warnings)
- packages/web-client/src/components/user_profile.tsx (5 warnings)

### Verification

- [x] Run `pnpm lint` - 139 warnings (49% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors

## New Helper Modules Created (22 files)

1. scripts/restore-interactive-prompts.ts
2. scripts/backup-interactive-prompts.ts
3. scripts/backup-scheduler-helpers.ts
4. scripts/populate-mock-data-templates.ts
5. scripts/replicate-helpers.ts
6. scripts/replicate-core.ts
7. scripts/integration-test-helpers.ts
8. scripts/restore-helpers.ts
9. scripts/restore-ndjson-helpers.ts
10. packages/web-api/src/github/query-builder.ts
11. packages/web-api/src/github/issue-fetcher.ts
12. packages/web-api/src/github/sync-helpers.ts
13. packages/web-api/src/routes/users-helpers.ts
14. packages/web-api/src/routes/auth-helpers.ts
15. packages/core-server/src/api/user-registry-design-docs.ts
16. packages/core-server/src/api/user-registry-test.ts
17. packages/telegram_bot/src/bot/commands/github-helpers.ts
18. packages/telegram_bot/src/bot/commands/link-helpers.ts
19. packages/mcp_server/src/auth/user-auth-helpers.ts
20. packages/mcp_server/src/integration-tests/setup/global-helpers.ts
21. packages/telegram_bot/src/integration-tests/vcr/cassette-helpers.ts

## Review

[To be filled during review phase]

## Notes

- Focus on non-UI files as they refactor more cleanly
- React components with heavy JSX are challenging to split
- Achieved 49% reduction (131 warnings fixed)
- Remaining warnings mostly in React components (todo_board, todo_table, user_profile, database_setup)
