# linting rule to prohibit barrel exports

**Status:** In Progress
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

- [ ] Functional: ESLint rule configured to error on ALL wildcard re-exports (`export * from`)
- [ ] Functional: All 5 barrel export files refactored to explicit named exports
- [ ] Functional: Transitive package re-exports in core-client and core-server converted to explicit exports
- [ ] Functional: All existing imports continue to work without changes
- [ ] Quality: `pnpm lint` passes with no wildcard export violations
- [ ] Quality: `pnpm tsc:check` passes with no type errors
- [ ] Quality: `pnpm build` succeeds
- [ ] Quality: `pnpm test` passes (all test suites)
- [ ] Documentation: eslint.config.js includes comment explaining the rule and exception pattern
- [ ] User validation: Manual verification that commonly imported items still work (e.g., import from core-shared in web-client)

## Implementation Plan

### Phase 1: Configure ESLint Rule

- [x] Add `no-restricted-syntax` rule to ban ExportAllDeclaration to eslint.config.js
- [x] Add explanatory comment about rule rationale

### Phase 2: Refactor Simple Barrel Exports

- [x] Refactor packages/core-client/src/config/index.ts (1 wildcard → 4 named exports)
- [x] Refactor packages/core-server/src/config/index.ts (1 wildcard → 11 named exports)
- [x] Run `pnpm tsc:check` to verify types

### Phase 3: Refactor Core-Shared Package

- [ ] Refactor packages/core-shared/src/index.ts types section (5 wildcards → ~25 named exports)
- [ ] Refactor packages/core-shared/src/index.ts versions section (6 wildcards → ~15 named exports)
- [ ] Refactor packages/core-shared/src/index.ts utils section (6 wildcards → ~15 named exports)
- [ ] Run `pnpm tsc:check` to verify types

### Phase 4: Refactor Core-Client and Core-Server

- [ ] Refactor packages/core-client/src/index.ts (2 wildcards → explicit exports from core-shared + config)
- [ ] Refactor packages/core-server/src/index.ts (5 wildcards → explicit exports from core-shared + server modules, fix duplicate exports)
- [ ] Run `pnpm tsc:check` to verify types

### Phase 5: Quality Checks

- [ ] Automated test: Run `pnpm lint` - should pass with no errors
- [ ] Automated test: Run `pnpm tsc:check` - should pass with no errors
- [ ] Automated test: Run `pnpm build` - should complete successfully
- [ ] Automated test: Run `pnpm test` - all tests should pass
- [ ] User test: Verify import from '@eddo/core-shared' works in web-client/src/components/week.tsx
- [ ] User test: Verify import from '@eddo/core-client' works in web-client/src/pages/settings.tsx
- [ ] User test: Verify import from '@eddo/core-server' works in web-api/src/routes/health.ts
