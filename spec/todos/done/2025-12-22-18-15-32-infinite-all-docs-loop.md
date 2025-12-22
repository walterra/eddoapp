# Investigate infinite \_all_docs loop in web-api dev server

**Status:** Done
**Created:** 2025-12-22-18-15-32
**Started:** 2025-12-22-18-20-15
**Agent PID:** 98482

## Description

**Root Cause Found:** GitHub sync scheduler causes excessive `_all_docs` database queries that appear as an infinite loop.

**How it happens:**

1. GitHub sync scheduler runs every 60 seconds (sync-scheduler.ts:89)
2. For each user with GitHub sync enabled, it fetches ALL their GitHub issues
3. For EACH issue, `findTodoByExternalId()` calls `db.list({ include_docs: true })` which is equivalent to `_all_docs?include_docs=true`
4. If a user has 100 GitHub issues, that's 100 full database scans per minute
5. With multiple syncing users, this creates 10-15+ req/sec pattern observed in logs

**Current inefficient code** (sync-utils.ts:38-51):

```typescript
export async function findTodoByExternalId(...) {
  const result = await db.list({ include_docs: true }); // ← Scans ALL documents!
  const todo = result.rows
    .map((row) => row.doc)
    .filter((doc): doc is TodoAlpha3 => doc !== undefined && doc.externalId === externalId)[0];
  return todo || null;
}
```

**Solution:** Add `externalId` index and use efficient Mango query instead of full table scan.

**Success criteria:**

- `_all_docs` requests drop to near-zero during GitHub sync operations
- CouchDB CPU usage remains <100% during sync
- GitHub sync still functions correctly (can find existing todos by externalId)
- All tests pass

## Implementation Plan

- [x] Add externalId index definition to REQUIRED_INDEXES (packages/core-shared/src/api/database-structures.ts:97)
- [x] Rewrite findTodoByExternalId to use db.find() with index (packages/web-api/src/github/sync-utils.ts:38-51)
- [x] Update sync-utils tests to verify db.find() is called instead of db.list()
- [x] Fix get_active_time_tracking to use MapReduce view (packages/mcp_server/src/mcp-server.ts:1004)
- [x] Add tags index to REQUIRED_INDEXES (packages/core-shared/src/api/database-structures.ts)
- [x] Update user memories query to use tags index (packages/mcp_server/src/mcp-server.ts:1119)
- [x] All unit tests pass (460 tests)
- [x] Linting and formatting pass (0 errors, 214 pre-existing warnings)
- [x] Build succeeds (all packages)
- [x] Manual test: Enable GitHub sync, monitor CouchDB logs for \_all_docs reduction (VERIFIED by user)
- [x] Self-review: Found and fixed deduplication bug in getActiveTimeTracking
- [x] Final validation: All tests pass with bug fix

## Review

### Issues Found & Fixed

**Bug: getActiveTimeTracking returned duplicate todos**

- **Root cause:** MapReduce view emits one row per active session. Todo with 2 active sessions → 2 rows → duplicate in results
- **Fix:** Added deduplication using Set to track seen `_id` values
- **Test:** Created mock scenario, verified fix handles duplicates correctly

### Code Quality Checks

- ✅ All error handling in place (try-catch with graceful fallbacks)
- ✅ Type safety maintained (TypeScript checks pass)
- ✅ Indexes properly named and consistent
- ✅ Comments explain why changes were made
- ✅ No breaking changes to API contracts

## Notes

**Why no migration script needed:**

- New users: Index created automatically during registration via `setupUserDatabase()`
- Existing users: CouchDB auto-creates index on first query when it sees `use_index: 'externalId-index'`
- `db.createIndex()` is idempotent - returns `'exists'` if already present
- No downtime or manual intervention required

**Additional query audit findings:**

Web-client queries: ✅ All use MapReduce views (efficient)

- `useTodosByWeek` → `todos_by_due_date/byDueDate` view
- `useTimeTrackingActive` → `todos_by_time_tracking_active/byTimeTrackingActive` view
- `useActivitiesByWeek` → `todos_by_active/byActive` view

MCP server queries: ✅ FIXED (3 queries audited)

1. **get_active_time_tracking** (mcp-server.ts:1004) - FIXED ✅
   - Before: `db.find({ selector: { version: 'alpha3', active: { $exists: true } } })` - full table scan
   - After: `db.view('todos_by_time_tracking_active', 'byTimeTrackingActive', { include_docs: true })`
   - Impact: Uses existing MapReduce view, no new index needed

2. **User memories query** (mcp-server.ts:1119, used in briefing/recap) - FIXED ✅
   - Before: `db.find({ selector: { tags: { $elemMatch: { $eq: 'user:memory' } } } })` - full table scan
   - After: Added `use_index: 'tags-index'` directive + created tags-index in REQUIRED_INDEXES
   - Impact: Efficient indexed lookup for memory todos

3. **list_todos** (mcp-server.ts:427) - Already optimal ✅
   - Has explicit index selection logic
   - Uses version-due/version-context-due/version-completed-due indexes correctly
