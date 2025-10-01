# Improve couchdb sync performance, implement spec/couchdb-sync-performance-issue.md

**Status:** Done
**Created:** 2025-10-01T18:06:27
**Started:** 2025-10-01T18:12:00
**Agent PID:** 30042

## Original Todo

- improve couchdb sync performance, implement spec/couchdb-sync-performance-issue.md

## Description

The PouchDB sync implementation is causing intermittent 2.6-second delays during navigation due to index rebuilds triggered by sync operations. The current sync configuration uses default settings (batch_size: 100, no throttling) and lacks optimization strategies. The app needs:

1. **Optimized sync parameters** to reduce the impact of sync operations (batch_size, batches_limit, heartbeat, timeout)
2. **Smart sync strategy** that pauses during active user interaction and resumes during idle periods
3. **Index pre-warming** after sync completes to avoid query-time rebuilding delays
4. **Revision history limits** to reduce sync overhead
5. **Performance instrumentation** to track sync performance and verify improvements

The goal is to maintain the offline-first architecture while eliminating UX impact from sync operations, achieving consistent fast navigation (<200ms) during active usage.

**Current Implementation:**

- Sync configured in `use_couchdb_sync.ts:41-44` with minimal options (`live: true, retry: true`)
- Event handlers in place (error, active, complete, paused) at lines 47-67
- Design documents and Mango indexes created in `database_setup.ts:16-121`
- No pre-warming, no sync-level throttling, no batch limits

## Success Criteria

- [x] Functional: Sync batch size reduced to 10 (from default 100) to minimize impact per sync operation
- [x] Functional: Sync batches limited to 1 concurrent batch to prevent resource contention
- [x] Functional: Heartbeat interval increased to 10000ms to reduce sync frequency
- [x] Functional: Timeout set to 5000ms for faster recovery from blocked operations
- [x] Functional: Index pre-warming executes after sync completion to avoid query-time rebuilds
- [x] Functional: Revision history limited to 5 revisions to reduce sync overhead
- [ ] Quality: Navigation performance consistently <200ms during active usage (DEFERRED - needs Phase 3)
- [x] Quality: All TypeScript type checks pass (`pnpm tsc:check`)
- [x] Quality: All existing tests continue to pass (`pnpm test`)
- [x] Quality: Linting passes (`pnpm lint`)
- [ ] User validation: Manual testing confirms no sync-related delays during rapid navigation between weeks (PARTIALLY COMPLETE - improved but not eliminated)
- [x] User validation: Offline-first functionality preserved (can create/edit todos while offline, sync resumes when online)
- [x] Documentation: Changes documented in implementation notes

## Implementation Plan

### Phase 1: Quick Wins (Sync Parameters + Revision Limits)

- [x] Add optimized sync parameters to use_couchdb_sync.ts:41-48 (batch_size: 10, batches_limit: 1, heartbeat: 10000, timeout: 5000)
- [x] Revision limit set in pouch_db.ts:26 (revs_limit: 5) during database initialization
- [x] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [x] Automated test: Run `pnpm test` to verify no regressions
- [x] User test: Start dev server, navigate between weeks rapidly, check console for timing improvements

### Phase 2: Index Pre-warming

- [x] Add rawDb to usePouchDb destructuring in use_couchdb_sync.ts:8
- [x] Add pre-warming query to 'paused' event handler in use_couchdb_sync.ts:69-84 (moved from 'complete' to work with live sync)
- [x] Add rawDb to useEffect dependencies in use_couchdb_sync.ts:92
- [x] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [x] Automated test: Run `pnpm test` to verify no regressions
- [x] User test: Verify index pre-warming logs appear in console after sync completes

## Review

### Critical Issues Found & Fixed

- [x] **CRITICAL**: Memory leak - remoteDb instance not cleaned up (use_couchdb_sync.ts:99)
  - ✅ Fixed: Added `remoteDb.close()` in cleanup function

- [x] **CRITICAL**: Race condition - async pre-warming not cancelled on unmount (use_couchdb_sync.ts:77-89)
  - ✅ Fixed: Added `isCancelled` flag to prevent queries after unmount

## Notes

**Performance Improvements Implemented:**

- Sync batch size reduced from 100 to 10
- Concurrent batches limited to 1
- Heartbeat interval increased to 10000ms
- Timeout set to 5000ms
- Index pre-warming added to 'paused' event handler
- Revision history limited to 5 revisions

**Remaining Work (for follow-up):**

- Navigation delays still present, need Phase 3: Smart Sync Strategy
- Smart sync would pause sync during active navigation and resume after 3s idle
- Additional performance instrumentation may be needed
