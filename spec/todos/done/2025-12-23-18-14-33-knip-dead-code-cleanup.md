# Use knip to identify dead code we can clean up

**Status:** Done
**Started:** 2025-12-23-18-20-11
**GitHub Issue:** #301
**Created:** 2025-12-23-18-14-33
**Agent PID:** 37321

## Description

Run knip to identify unused exports, dependencies, and dead code across the monorepo. Clean up safe-to-remove items.

**Success criteria:**

- Knip runs with no warnings
- Dead code removed without breaking tests/builds
- All tests pass after cleanup

## Analysis Summary

Running `pnpm knip` shows **no issues** with current configuration. However, `npx knip --trace` reveals 206 exports without external consumers. After filtering:

### Truly Unused Code to Remove

**1. telegram_bot/src/agent/types/workflow-types.ts - Unused types (lines 6-114)**
These workflow planning types are defined but never used:

- `TaskComplexity`
- `TaskComplexityAnalysis`
- `ExecutionStep`
- `ExecutionPlan`
- `ApprovalRequest`
- `ExecutionSummary`
- `WorkflowState`
- `WorkflowNode`
- `RouteFunction`

Only `WorkflowConfig` and `WorkflowResult` are used by the agent.

**2. telegram_bot/src/bot/bot.ts - SessionData type**
Exported but only used internally.

**3. printer_service/src/printer/client.ts - createPrinterInstance**
Internal function not exposed via index.ts, not used by CLI.

**4. printer_service/src/printer/formatter.ts - formatForThermalPrinter**
Internal function not exposed via index.ts.

**5. printer_service/src/utils/config.ts - createPrinterConfig**
Internal function, `appConfig` is used instead.

**6. Various debug/cache helper exports** (lower priority):

- `telegram_bot/src/utils/user-lookup.ts`: `clearUserCache`, `getCacheStats`
- `telegram_bot/src/bot/middleware/auth.ts`: `generateLinkingInstructions`, constants
- `mcp_server/src/auth/user-auth.ts`: `clearAuthCache`, `getAuthCacheStats`

### Not Removing (Intentional API)

- Barrel exports from index.ts files (public API surface)
- Type exports alongside factory functions (TypeScript convention)
- Test utilities

## Implementation Plan

- [x] Remove unused workflow types from `workflow-types.ts` (keep WorkflowConfig, WorkflowResult)
- [x] Remove `SessionData` export from bot.ts (keep interface for internal use)
- [x] Remove unused exports from printer_service internal files
- [x] Remove unused cache debug exports from user-lookup.ts and user-auth.ts
- [x] Automated test: `pnpm test` - 462 tests pass
- [x] Automated test: `pnpm tsc:check` - passes
- [x] Automated test: `pnpm build` - passes
- [x] User test: `pnpm knip --trace | grep " x$" | wc -l` reduced from 206 to 189

## Review

- [x] No regressions found - all exports still work correctly
- [x] BotContext still exported and used across 5 files
- [x] WorkflowConfig and WorkflowResult still exported from agent/index.ts
- [x] Internal functions (createPrinterInstance, formatForThermalPrinter, createPrinterConfig) still work internally

## Notes

- Knip config has empty entry arrays, relies on package.json auto-discovery
- `includeEntryExports: true` means index.ts barrel exports are excluded from unused analysis
- Many "unused" exports are intentional public API or TypeScript type inference patterns
