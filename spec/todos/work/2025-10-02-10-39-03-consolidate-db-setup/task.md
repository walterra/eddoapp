# consolidate packages/web-api/src/utils/setup-user-db.ts and packages/web-client/src/database_setup.ts

**Status:** Refining
**Created:** 2025-10-02T10:39:03Z
**Agent PID:** 30042

## Original Todo

consolidate packages/web-api/src/utils/setup-user-db.ts and packages/web-client/src/database_setup.ts

## Description

Extract duplicated database structure definitions (design documents and indexes) from `packages/web-api/src/utils/setup-user-db.ts` and `packages/web-client/src/database_setup.ts` into a shared module in `packages/core-shared/src/`. Both files currently define the same MapReduce views and Mango indexes. The consolidation will:

- Create shared type-safe definitions for design documents (todos, tags views) and indexes
- Update web-api setup to import and use shared definitions
- Update web-client setup to import and use shared definitions
- Maintain existing functionality - both server and client setup functions continue to work as before
- Preserve the dual initialization strategy (server admin operations + client-side validation)

## Success Criteria

- [ ] Shared database structure definitions exist in core-shared package
- [ ] web-api setup-user-db.ts imports and uses shared definitions (no duplicated view/index code)
- [ ] web-client database_setup.ts imports and uses shared definitions (no duplicated view/index code)
- [ ] All existing tests pass (pnpm test)
- [ ] TypeScript compilation succeeds (pnpm tsc:check)

## Implementation Plan

- [ ] Create `packages/core-shared/src/api/database-structures.ts` with shared design document and index definitions
- [ ] Export new module from `packages/core-shared/src/index.ts`
- [ ] Update `packages/web-api/src/utils/setup-user-db.ts` to import and use shared definitions
- [ ] Update `packages/web-client/src/database_setup.ts` to import and use shared definitions
- [ ] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [ ] Automated test: Run `pnpm test` to verify all tests pass
- [ ] User test: Verify no functionality changes - both server and client setup still work correctly

## Review

## Notes
