# Improve couchdb sync performance, implement spec/couchdb-sync-performance-issue.md

**Status:** In Progress
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

- [ ] Functional: Sync batch size reduced to 10 (from default 100) to minimize impact per sync operation
- [ ] Functional: Sync batches limited to 1 concurrent batch to prevent resource contention
- [ ] Functional: Heartbeat interval increased to 10000ms to reduce sync frequency
- [ ] Functional: Timeout set to 5000ms for faster recovery from blocked operations
- [ ] Functional: Index pre-warming executes after sync completion to avoid query-time rebuilds
- [ ] Functional: Smart sync strategy pauses during active navigation and resumes after 3s of inactivity
- [ ] Functional: Revision history limited to 5 revisions to reduce sync overhead
- [ ] Quality: Navigation performance consistently <200ms during active usage (measured via browser DevTools)
- [ ] Quality: All TypeScript type checks pass (`pnpm tsc:check`)
- [ ] Quality: All existing tests continue to pass (`pnpm test`)
- [ ] Quality: Linting passes (`pnpm lint`)
- [ ] User validation: Manual testing confirms no sync-related delays during rapid navigation between weeks
- [ ] User validation: Offline-first functionality preserved (can create/edit todos while offline, sync resumes when online)
- [ ] Documentation: Changes documented in implementation notes

## Implementation Plan

### Phase 1: Quick Wins (Sync Parameters + Revision Limits)

- [x] Add optimized sync parameters to use_couchdb_sync.ts:41-48 (batch_size: 10, batches_limit: 1, heartbeat: 10000, timeout: 5000)
- [x] Revision limit set in pouch_db.ts:26 (revs_limit: 5) during database initialization
- [x] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [x] Automated test: Run `pnpm test` to verify no regressions
- [ ] User test: Start dev server, navigate between weeks rapidly, check console for timing improvements

### Phase 2: Index Pre-warming

- [x] Add rawDb to usePouchDb destructuring in use_couchdb_sync.ts:8
- [x] Add pre-warming query to 'complete' event handler in use_couchdb_sync.ts:65-79
- [x] Add rawDb to useEffect dependencies in use_couchdb_sync.ts:92
- [x] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [x] Automated test: Run `pnpm test` to verify no regressions
- [ ] User test: Verify index pre-warming logs appear in console after sync completes

### Phase 3: Smart Sync Strategy

- [ ] Create use_smart_sync.ts hook in packages/web-client/src/hooks/
- [ ] Implement activity detection with mousemove, keydown, and visibilitychange listeners
- [ ] Implement debounced sync resume logic (3s delay using lodash-es debounce)
- [ ] Implement sync pause/resume mechanism
- [ ] Replace useCouchDbSync with useSmartSync in eddo.tsx:16
- [ ] Automated test: Run `pnpm tsc:check` to verify TypeScript compilation
- [ ] Automated test: Run `pnpm test` to verify no regressions
- [ ] Automated test: Run `pnpm lint` to verify code style
- [ ] User test: Verify sync pauses during active navigation and resumes after 3s idle
- [ ] User test: Verify no sync-related delays during rapid week navigation
- [ ] User test: Test offline functionality (create/edit todos offline, verify sync when online)
- [ ] User test: Measure navigation performance with browser DevTools (<200ms target)

## Review

## Notes
