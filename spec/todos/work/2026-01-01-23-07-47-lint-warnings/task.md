# Run pnpm lint and fix warnings

**GitHub Issue:** [#350](https://github.com/walterra/eddoapp/issues/350)
**Status:** Review
**Started:** 2026-01-01-23-15
**Created:** 2026-01-01-23-07-47
**Agent PID:** 34113

## Description

The codebase has ESLint warnings related to code quality (function complexity and size). The goal is to reduce these warnings by refactoring complex functions into smaller, more focused helpers.

| Warning Type           | Original | Current | Reduction |
| ---------------------- | -------- | ------- | --------- |
| max-lines-per-function | 112      | 67      | 40%       |
| complexity             | 68       | 35      | 49%       |
| max-depth              | 40       | 8       | 80%       |
| max-statements         | 28       | 4       | 86%       |
| max-lines              | 18       | 7       | 61%       |
| max-params             | 4        | 6       | -50%\*    |

\*max-params increased slightly due to new helper functions with explicit parameters

**Final Status:** 127 warnings (down from 270, 143 fixed = 53% reduction)

**Success Criteria:**

- [x] All tests pass (`pnpm test`) - 508 passed
- [x] Code maintains same functionality
- [x] Significant reduction in warnings - 53% achieved
- [x] No TypeScript errors (`pnpm tsc:check`)
- [x] No lint errors (only warnings)

## Implementation Plan

### Session 2 - Additional Refactoring (5 files)

20. **packages/web-client/src/database_setup.ts** ✅ → database_setup_helpers.ts (6 → 0 warnings)
21. **packages/web-client/src/components/user_profile.tsx** ✅ → user*profile_types.ts, user_profile_tab*\*.tsx (5 → 3 warnings, -2)
22. **packages/web-client/src/components/todo_board.tsx** ✅ → todo_board_state.ts (4 → 2 warnings, -2)
23. **packages/web-client/src/components/todo_edit_modal.tsx** ✅ → todo_edit_modal_fields.tsx, todo_edit_modal_error.tsx (3 → 1 warning, -2)
24. **packages/web-client/src/components/todo_table.tsx** ✅ - Reused todo_board_state.ts (3 → 2 warnings, -1)

### Previous Session - Completed Refactoring (19 files)

1-19. Various scripts and packages ✅ (see previous notes)

### Verification

- [x] Run `pnpm lint` - 127 warnings (53% reduction from 270)
- [x] Run `pnpm test` - all tests pass (508 passed)
- [x] Run `pnpm tsc:check` - no type errors

## New Helper Modules Created (35 files)

**Session 2:** 26. packages/web-client/src/database_setup_helpers.ts 27. packages/web-client/src/components/user_profile_types.ts 28. packages/web-client/src/components/user_profile_tab_profile.tsx 29. packages/web-client/src/components/user_profile_tab_security.tsx 30. packages/web-client/src/components/user_profile_tab_integrations.tsx 31. packages/web-client/src/components/user_profile_tab_preferences.tsx 32. packages/web-client/src/components/todo_board_state.ts 33. packages/web-client/src/components/todo_edit_modal_fields.tsx 34. packages/web-client/src/components/todo_edit_modal_error.tsx

**Session 1:**
1-25. (See previous notes)

## Review

### Self-Assessment

**Quality improvements achieved:**

- Extracted complex retry/initialization logic into reusable hooks
- Split large React components into focused sub-components
- Created shared state management hooks (useDbInitialization, useTodoBoardData)
- Extracted form fields into reusable components
- Reduced deeply nested code (max-depth: 80% reduction)

**Remaining warnings:**

- 127 warnings spread across ~80 files (avg 1.6 warnings/file)
- Highest: 3 warnings per file (test files, integration setup)
- Most are inherent complexity in React components or test utilities

**No issues found during review.**

## Notes

- React components with heavy JSX are challenging to split further
- Test files and integration setup have inherent complexity
- Shared hooks between TodoBoard and TodoTable reduced duplication
- Further reduction would require fundamental restructuring
- 53% reduction is a meaningful improvement for code maintainability
