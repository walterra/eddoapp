# linting rule to prohibit barrel exports

**Status:** Refining
**Created:** 2025-10-01T14:23:16Z
**Agent PID:** 70023

## Original Todo

linting rule to prohibit barrel exports

## Description

Add ESLint rule to prohibit wildcard barrel exports (`export * from './module'`) to improve tree-shaking, reduce circular dependency risks, and maintain explicit API surfaces. This involves:

1. Adding `eslint-plugin-import` rule `no-anonymous-default-export` and custom rule for wildcard exports
2. Refactoring 5 existing barrel export files (33 wildcard exports total) to use explicit named exports
3. Allowing transitive package re-exports (`export * from '@eddo/core-shared'`) as they serve legitimate aggregation purposes

The refactoring will convert patterns like:

```typescript
export * from './utils/generate_stable_key';
```

To explicit exports:

```typescript
export { generateStableKey } from './utils/generate_stable_key';
```

## Success Criteria

- [ ] Functional: ESLint rule configured to error on wildcard re-exports (`export * from`)
- [ ] Functional: Rule allows transitive package re-exports (e.g., `export * from '@eddo/core-shared'`)
- [ ] Functional: All 5 barrel export files refactored to explicit named exports
- [ ] Functional: All existing imports continue to work without changes
- [ ] Quality: `pnpm lint` passes with no wildcard export violations
- [ ] Quality: `pnpm tsc:check` passes with no type errors
- [ ] Quality: `pnpm build` succeeds
- [ ] Quality: `pnpm test` passes (all test suites)
- [ ] Documentation: eslint.config.js includes comment explaining the rule and exception pattern
- [ ] User validation: Manual verification that commonly imported items still work (e.g., import from core-shared in web-client)

## Implementation Plan

### Phase 1: Configure ESLint Rule

- [ ] Add `no-export-all` rule from eslint-plugin-import to eslint.config.js (packages/core-shared/src/index.ts:1-17, packages/core-client/src/index.ts:1-2, packages/core-server/src/index.ts:1-13, packages/core-client/src/config/index.ts:1, packages/core-server/src/config/index.ts:1)
- [ ] Configure exception pattern for transitive exports (e.g., `export * from '@eddo/*'`)
- [ ] Add explanatory comment about rule rationale

### Phase 2: Refactor Simple Barrel Exports

- [ ] Refactor packages/core-client/src/config/index.ts (1 wildcard → 4 named exports)
- [ ] Refactor packages/core-server/src/config/index.ts (1 wildcard → 11 named exports)
- [ ] Run `pnpm tsc:check` to verify types

### Phase 3: Refactor Core-Shared Package

- [ ] Refactor packages/core-shared/src/index.ts types section (5 wildcards → ~25 named exports)
- [ ] Refactor packages/core-shared/src/index.ts versions section (6 wildcards → ~15 named exports)
- [ ] Refactor packages/core-shared/src/index.ts utils section (6 wildcards → ~15 named exports)
- [ ] Run `pnpm tsc:check` to verify types

### Phase 4: Refactor Core-Client and Core-Server

- [ ] Refactor packages/core-client/src/index.ts (1 wildcard → 4 named exports, preserve transitive export)
- [ ] Refactor packages/core-server/src/index.ts (4 wildcards → ~25 named exports, preserve transitive export, fix duplicate exports)
- [ ] Run `pnpm tsc:check` to verify types

### Phase 5: Quality Checks

- [ ] Automated test: Run `pnpm lint` - should pass with no errors
- [ ] Automated test: Run `pnpm tsc:check` - should pass with no errors
- [ ] Automated test: Run `pnpm build` - should complete successfully
- [ ] Automated test: Run `pnpm test` - all tests should pass
- [ ] User test: Verify import from '@eddo/core-shared' works in web-client/src/components/week.tsx
- [ ] User test: Verify import from '@eddo/core-client' works in web-client/src/pages/settings.tsx
- [ ] User test: Verify import from '@eddo/core-server' works in web-api/src/routes/health.ts
