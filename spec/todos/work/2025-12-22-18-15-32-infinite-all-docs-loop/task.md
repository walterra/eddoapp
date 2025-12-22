# Investigate infinite \_all_docs loop in web-api dev server

**Status:** Refining
**Created:** 2025-12-22-18-15-32
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

- [ ] Add externalId index definition to REQUIRED_INDEXES (packages/core-shared/src/api/database-structures.ts:97)
- [ ] Rewrite findTodoByExternalId to use db.find() with index (packages/web-api/src/github/sync-utils.ts:38-51)
- [ ] Add database migration utility to create externalId index on existing databases
- [ ] Update setup-user-db tests to verify externalId index creation
- [ ] Add integration test: findTodoByExternalId with 100+ todos to verify index usage
- [ ] Manual test: Enable GitHub sync, monitor CouchDB logs for \_all_docs reduction
- [ ] Update sync-utils tests to verify db.find() is called instead of db.list()

## Review

## Notes
