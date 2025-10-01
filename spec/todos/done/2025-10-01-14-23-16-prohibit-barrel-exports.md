# linting rule to prohibit barrel exports

**Status:** Done
**Started:** 2025-10-01T14:23:45Z
**Created:** 2025-10-01T14:23:16Z
**Agent PID:** 70023

## Original Todo

linting rule to prohibit barrel exports

## Description

Add ESLint rule to prohibit wildcard barrel exports (`export * from './module'`) to improve tree-shaking, reduce circular dependency risks, and maintain explicit API surfaces. This involves:

1. Adding ESLint rule using `no-restricted-syntax` to ban all wildcard re-exports
2. Refactoring 5 existing barrel export files (33 wildcard exports total) to use explicit named exports
3. Refactoring transitive package re-exports in core-client and core-server to explicit exports as well

The refactoring will convert patterns like:

```typescript
export * from './utils/generate_stable_key';
```

To explicit exports:

```typescript
export { generateStableKey } from './utils/generate_stable_key';
```

## Success Criteria

- [x] Functional: ESLint rule configured to error on ALL wildcard re-exports (`export * from`)
- [x] Functional: All 5 barrel export files refactored to explicit named exports
- [x] Functional: Transitive package re-exports in core-client and core-server converted to explicit exports
- [x] Functional: All existing imports continue to work without changes
- [x] Quality: `pnpm lint` passes with no wildcard export violations
- [x] Quality: `pnpm tsc:check` passes with no type errors
- [x] Quality: `pnpm build` succeeds
- [x] Quality: `pnpm test` passes (all test suites)
- [x] Documentation: eslint.config.js includes comment explaining the rule and exception pattern
- [x] User validation: Manual verification that commonly imported items still work (e.g., import from core-shared in web-client)

## Implementation Plan

### Phase 1: Configure ESLint Rule

- [x] Add `no-restricted-syntax` rule to ban ExportAllDeclaration to eslint.config.js
- [x] Add explanatory comment about rule rationale

### Phase 2: Refactor Simple Barrel Exports

- [x] Refactor packages/core-client/src/config/index.ts (1 wildcard → 4 named exports)
- [x] Refactor packages/core-server/src/config/index.ts (1 wildcard → 11 named exports)
- [x] Run `pnpm tsc:check` to verify types

### Phase 3: Refactor Core-Shared Package

- [x] Refactor packages/core-shared/src/index.ts types section (5 wildcards → ~25 named exports)
- [x] Refactor packages/core-shared/src/index.ts versions section (7 wildcards → ~15 named exports)
- [x] Refactor packages/core-shared/src/index.ts utils section (5 wildcards → ~10 named exports)
- [x] Run `pnpm tsc:check` to verify types

### Phase 4: Refactor Core-Client and Core-Server

- [x] Refactor packages/core-client/src/index.ts (2 wildcards → explicit exports from core-shared + config)
- [x] Refactor packages/core-server/src/index.ts (5 wildcards → explicit exports from core-shared + server modules, removed duplicate exports)
- [x] Run `pnpm tsc:check` to verify types

### Phase 5: Quality Checks

- [x] Automated test: Run `pnpm lint` - should pass with no errors
- [x] Automated test: Run `pnpm tsc:check` - should pass with no errors
- [x] Automated test: Run `pnpm build` - should complete successfully
- [x] Automated test: Run `pnpm test` - all tests should pass (365 tests passed)
- [x] User test: Verify import from '@eddo/core-shared' works in web-client/src/components/week.tsx
- [x] User test: Verify import from '@eddo/core-client' works in web-client/src/pages/settings.tsx
- [x] User test: Verify import from '@eddo/core-server' works in web-api/src/routes/health.ts

## Notes

### Implementation Summary

Successfully implemented ESLint rule to prohibit all wildcard barrel exports and refactored all existing barrel export files to use explicit named exports.

**Files Modified:**

1. `eslint.config.js` - Added `no-restricted-syntax` rule targeting `ExportAllDeclaration`
2. `packages/core-client/src/config/index.ts` - 1 wildcard → 4 explicit exports
3. `packages/core-server/src/config/index.ts` - 1 wildcard → 11 explicit exports
4. `packages/core-shared/src/index.ts` - 17 wildcards → 83 explicit exports (types, versions, utils)
5. `packages/core-client/src/index.ts` - 2 wildcards → 68 explicit exports (re-exports from core-shared + config)
6. `packages/core-server/src/index.ts` - 5 wildcards → 85 explicit exports (re-exports from core-shared + server modules)

**Total Wildcard Exports Removed:** 33 across 5 files

**Approach Used:**

- Used ESLint's built-in `no-restricted-syntax` rule with `ExportAllDeclaration` selector
- No third-party plugins needed
- Clear error message guides developers to use explicit exports
- All transitive re-exports (e.g., core-client re-exporting from core-shared) converted to explicit

**Benefits Achieved:**

- ✅ Improved tree-shaking capabilities
- ✅ Reduced circular dependency risks
- ✅ Explicit API surface documentation
- ✅ Better IDE autocomplete performance
- ✅ Easier to track what's exported from each package
