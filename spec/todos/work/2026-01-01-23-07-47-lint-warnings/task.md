# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress (Session 5)
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 34113

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

**Current Status:** 62 warnings (down from 270, 208 fixed = 77% reduction)

**Success Criteria:**

- [x] All tests pass (`pnpm test`) - 508 passed
- [x] Code maintains same functionality
- [x] Significant reduction in warnings - 77% achieved
- [x] No TypeScript errors (`pnpm tsc:check`)
- [x] No lint errors (only warnings)

## Implementation Plan

### Session 5 - Current Refactoring (21 warnings fixed)

Files refactored:

1. `packages/telegram_bot/src/scheduler/helpers/telegram-sender.ts` - `logSuccessfulSend` → options object
2. `scripts/backup-interactive-prompts-helpers.ts` - `mergeConfig` → options object
3. `packages/web-api/src/github/issue-fetcher.ts` - `fetchPage` → options object, extracted `shouldStopPagination`
4. `packages/web-api/src/middleware/user-db.ts` - `proxyUserCouchDBRequest` → options object
5. `packages/core-shared/src/utils/parse_github_issue_id.ts` - extracted validation helpers
6. `scripts/replicate-helpers.ts` - extracted `displayHistoryStats`, `displaySuccessDetails`, `displayFailureDetails`
7. `scripts/restore-ndjson.ts` - extracted validation and logging helpers, refactored `parseArgs`
8. `scripts/restore-interactive.ts` - extracted validation helpers for `performRestore`
9. `packages/core-shared/src/api/test-utils.ts` - `createTestTodoAlpha3/Alpha2` → spread defaults
10. `packages/printer_service/src/printer/formatter.ts` - `wrapText` → extracted word processing helpers
11. `packages/web-api/src/utils/setup-user-db.ts` - extracted design doc helpers
12. `packages/web-api/src/routes/auth.ts` - extracted login helpers
13. `packages/web-client/src/components/user_profile_handlers.ts` - added `DEFAULT_PREFERENCES` object
14. `packages/core-server/src/api/user-registry-design-docs.ts` - extracted error checking and insert helpers
15. `packages/mcp_server/src/integration-tests/setup/database-setup.ts` - extracted `tryInsertDesignDocument`
16. `packages/mcp_server/src/integration-tests/setup/test-lock.ts` - extracted lock handling helpers
17. `scripts/__tests__/e2e/test-utils.ts` - extracted database state checking helpers

### Previous Sessions - Completed

Sessions 1-4: 53 files refactored, 187 warnings fixed.

### Verification

- [x] Run `pnpm lint` - 62 warnings (77% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors

## Patterns Applied

1. **Options Objects** - Functions with 5+ parameters refactored to use single options object
2. **Defaults Objects** - Complex nullish coalescing chains replaced with spread of defaults
3. **Helper Extraction** - Nested conditionals extracted into focused helper functions
4. **Error Type Guards** - Inline error checks extracted into named predicates
5. **State Checking** - Complex state checks extracted into dedicated functions

## Review

### Quality improvements achieved:

- Extracted message builders for auth middleware
- Split system prompt into composable sections
- Created middleware factories for bot
- Refactored MCP client with helper extraction
- Used options objects instead of many parameters
- Extracted sync logging and stats tracking
- Extracted command routing functions to reduce complexity
- Created preference extraction helpers
- Reduced nesting depth in async retry loops
- Simplified error handling with type guards

### Remaining warnings (62):

- React components with complex JSX (~35 warnings)
- Test utilities and script files (~15 warnings)
- Some remaining complex async functions (~12 warnings)
- Most remaining files have only 1-2 warnings each

## Notes

- 77% reduction achieved (62 from 270 original)
- Factory pattern used extensively for testability
- Options objects reduce parameter count warnings
- Message builder functions improve code organization
- Further reduction would require fundamental restructuring of large React components
- Many remaining warnings are in test utilities which are harder to refactor without affecting test clarity
