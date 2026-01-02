# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress (Session 4)
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 34113

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

**Current Status:** 83 warnings (down from 270, 187 fixed = 69% reduction)

**Success Criteria:**

- [x] All tests pass (`pnpm test`) - 508 passed
- [x] Code maintains same functionality
- [x] Significant reduction in warnings - 69% achieved
- [x] No TypeScript errors (`pnpm tsc:check`)
- [x] No lint errors (only warnings)

## Implementation Plan

### Session 4 - Current Refactoring

Files refactored with new helper modules:

1. packages/telegram_bot/src/bot/middleware/auth.ts → auth-helpers.ts
2. packages/telegram_bot/src/bot/commands/briefing.ts → briefing-helpers.ts
3. packages/telegram_bot/src/agent/system-prompt.ts → system-prompt-sections.ts
4. packages/telegram_bot/src/bot/handlers/message.ts → message-helpers.ts
5. packages/telegram_bot/src/agent/helpers/message-handler.ts → print-helpers.ts
6. packages/telegram_bot/src/bot/bot.ts → bot-middleware.ts
7. packages/telegram_bot/src/bot/commands/start.ts → start-helpers.ts
8. packages/telegram_bot/src/bot/commands/github.ts (refactored routing)
9. packages/telegram_bot/src/bot/commands/github-helpers.ts (refactored complexity)
10. packages/telegram_bot/src/mcp/client.ts → client-helpers.ts
11. packages/telegram_bot/src/mcp/connection-manager.ts → connection-manager-helpers.ts
12. packages/telegram_bot/src/integration-tests/vcr/cassette-manager.ts (options objects)
13. packages/telegram_bot/src/integration-tests/vcr/cassette-helpers.ts (options objects)
14. packages/telegram_bot/src/utils/user-lookup.ts → user-lookup-helpers.ts
15. packages/web-api/src/github/sync-scheduler.ts → sync-helpers-extended.ts
16. packages/web-api/src/github/rate-limit.ts (header parsing helpers)

### Previous Sessions - Completed

Sessions 1-3: 37 files refactored.

### Verification

- [x] Run `pnpm lint` - 83 warnings (69% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors

## New Helper Modules Created (Session 4)

1. packages/telegram_bot/src/bot/middleware/auth-helpers.ts
2. packages/telegram_bot/src/bot/commands/briefing-helpers.ts (extended)
3. packages/telegram_bot/src/agent/system-prompt-sections.ts
4. packages/telegram_bot/src/bot/handlers/message-helpers.ts
5. packages/telegram_bot/src/agent/helpers/print-helpers.ts
6. packages/telegram_bot/src/bot/bot-middleware.ts
7. packages/telegram_bot/src/bot/commands/start-helpers.ts
8. packages/telegram_bot/src/mcp/client-helpers.ts
9. packages/telegram_bot/src/mcp/connection-manager-helpers.ts
10. packages/telegram_bot/src/utils/user-lookup-helpers.ts
11. packages/web-api/src/github/sync-helpers-extended.ts

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

### Remaining warnings (83):

- React components with complex JSX (~40 warnings)
- Test utilities and script files (~25 warnings)
- Some remaining complex async functions (~18 warnings)
- Most remaining files have only 1-2 warnings each

## Notes

- 69% reduction achieved (83 from 270 original)
- Factory pattern used extensively for testability
- Options objects reduce parameter count warnings
- Message builder functions improve code organization
- Further reduction would require fundamental restructuring of large React components
- Many remaining warnings are in test utilities which are harder to refactor without affecting test clarity
