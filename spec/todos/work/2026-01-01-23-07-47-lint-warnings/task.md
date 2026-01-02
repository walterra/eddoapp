# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** In Progress
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 34113

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

**Current Status:** 106 warnings (down from 270, 164 fixed = 61% reduction)

**Success Criteria:**

- [x] All tests pass (`pnpm test`) - 508 passed
- [x] Code maintains same functionality
- [x] Significant reduction in warnings - 61% achieved
- [x] No TypeScript errors (`pnpm tsc:check`)
- [x] No lint errors (only warnings)

## Implementation Plan

### Session 3 - Current Refactoring (15 files refactored)

25. **packages/mcp_server/src/integration-tests/setup/database-setup.ts** ✅ - Extracted index error handlers
26. **packages/telegram_bot/src/integration-tests/setup/test-agent-server.ts** ✅ → test-agent-server-helpers.ts
27. **scripts/test-mcp.js** ✅ → test-mcp-helpers.js
28. **scripts/cleanup-interactive.ts** ✅ → cleanup-interactive-helpers.ts
29. **packages/web-client/src/components/user_profile_tab_profile.tsx** ✅ → user_profile_form_fields.tsx
30. **packages/web-client/src/components/user_profile.tsx** ✅ → user_profile_handlers.ts, user_profile_layout.tsx
31. **packages/web-client/src/hooks/use_couchdb_sync.ts** ✅ → use_couchdb_sync_helpers.ts
32. **packages/web-client/src/hooks/use_filter_preferences.ts** ✅ → use_filter_preferences_helpers.ts
33. **packages/web-client/src/hooks/use_profile.ts** ✅ → use_profile_types.ts, use_profile_api.ts
34. **packages/web-client/src/hooks/use_preferences_stream.ts** ✅ → use_preferences_stream_helpers.ts
35. **packages/web-client/src/hooks/use_todo_mutations.ts** ✅ → use_todo_mutations_helpers.ts
36. **packages/web-client/src/components/tag_input.tsx** ✅ → tag_input_helpers.ts
37. **scripts/backup-interactive-prompts.ts** ✅ → backup-interactive-prompts-helpers.ts

### Previous Sessions - Completed

Sessions 1-2: 24 files refactored.

### Verification

- [x] Run `pnpm lint` - 106 warnings (61% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors

## New Helper Modules Created (Session 3: 15 files)

1. packages/mcp_server/src/integration-tests/setup/database-setup.ts (refactored in place)
2. packages/telegram_bot/src/integration-tests/setup/test-agent-server-helpers.ts
3. scripts/test-mcp-helpers.js
4. scripts/cleanup-interactive-helpers.ts
5. packages/web-client/src/components/user_profile_form_fields.tsx
6. packages/web-client/src/components/user_profile_handlers.ts
7. packages/web-client/src/components/user_profile_layout.tsx
8. packages/web-client/src/hooks/use_couchdb_sync_helpers.ts
9. packages/web-client/src/hooks/use_filter_preferences_helpers.ts
10. packages/web-client/src/hooks/use_profile_types.ts
11. packages/web-client/src/hooks/use_profile_api.ts
12. packages/web-client/src/hooks/use_preferences_stream_helpers.ts
13. packages/web-client/src/hooks/use_todo_mutations_helpers.ts
14. packages/web-client/src/components/tag_input_helpers.ts
15. scripts/backup-interactive-prompts-helpers.ts

## Review

### Quality improvements achieved:

- Extracted API functions from hooks for better testability
- Created type definition files for better organization
- Split React components into layout and form field components
- Extracted cache management helpers for mutation hooks
- Reduced hook complexity significantly

### Remaining warnings (106):

- Spread across ~70 files (avg 1.5 warnings/file)
- Most are 1-2 warnings per file
- Remaining complex React components with JSX
- Test utilities and script files

## Notes

- 61% reduction achieved (106 from 270 original)
- Factory pattern used for API functions improves testability
- Type exports enable better type reuse across files
- Hooks refactored to use extracted helpers
- Further reduction would require fundamental restructuring of large React components
