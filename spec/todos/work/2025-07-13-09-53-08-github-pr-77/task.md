# https://github.com/walterra/eddoapp/pull/77

**Status:** In Progress
**Started:** 2025-07-13T09:53:08
**Created:** 2025-07-13T09:53:08
**Agent PID:** 62034

## Original Todo

https://github.com/walterra/eddoapp/pull/77

## Description

This task involves reviewing and fixing issues with a Dependabot pull request that upgrades Vitest from version 1.6.1 to 3.2.4 across the monorepo. While all tests pass, the build fails due to TypeScript compatibility issues in the telegram-bot package where Vitest v3's updated type system conflicts with overly specific mock function type annotations.

The PR needs to be:
1. Fixed to resolve TypeScript build errors in auth.test.ts
2. Verified that all tests still pass after fixes
3. Confirmed that the build completes successfully
4. Prepared for the user to merge

## Implementation Plan

- [x] Fix TypeScript errors in auth.test.ts by simplifying vi.fn mock type annotations (packages/telegram-bot/src/bot/middleware/auth.test.ts:36,39)
- [x] Automated test: Run TypeScript check to verify no compilation errors
- [x] Automated test: Run full test suite to ensure all tests still pass
- [x] Automated test: Run build command to verify successful compilation
- [ ] User test: Verify PR is ready for merge

## Notes

The Vitest upgrade from v1.6.1 to v3.2.4 required fixing TypeScript compatibility issues in the auth.test.ts file. The issue was resolved by simplifying overly specific type annotations for vi.fn mocks that were incompatible with Vitest v3's updated type system.

✅ All 329 tests pass (3 skipped)
✅ TypeScript compilation succeeds  
✅ Build completes successfully
✅ No breaking changes required in existing test code