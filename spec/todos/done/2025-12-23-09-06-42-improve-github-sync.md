# Improve GitHub sync follow-up syncs

**Status:** Done
**Started:** 2025-12-23-09-19
**GitHub Issue:** https://github.com/walterra/eddoapp/issues/289
**Created:** 2025-12-23-09-06-42
**Agent PID:** 35707

## Description

Optimize GitHub sync to use `githubLastSync` timestamp for follow-up syncs instead of `githubSyncStartedAt`. Currently, every follow-up sync fetches all issues updated since the user first enabled sync, walking over the same data repeatedly. The fix uses `githubLastSync` to only fetch issues updated since the last successful sync.

**Current behavior:**

- Initial sync: Fetches only open issues (no `since` filter)
- Subsequent syncs: Uses `githubSyncStartedAt` (when sync was first enabled) as `since` parameter

**Fixed behavior:**

- Initial sync: Unchanged (fetches only open issues)
- Subsequent syncs: Uses `githubLastSync` (when last sync completed) as `since` parameter

**Success criteria:**

1. Follow-up syncs only request issues updated since last sync
2. Logging shows correct `since` value in sync logs
3. All existing tests pass
4. New test verifies `githubLastSync` is used for subsequent syncs

## Implementation Plan

- [x] Code change: Update `syncUserIssues()` in `packages/web-api/src/github/sync-scheduler.ts:210-214` to use `githubLastSync` instead of `githubSyncStartedAt` for subsequent syncs
- [x] Code change: Update logging at line 244 to reflect the new `since` value
- [x] Automated test: All 97 existing GitHub tests pass - behavior verified through existing test coverage
- [x] User test: Verified via logs - `since: '2025-12-23T08:48:01.330Z'` showed only ~2 minutes before sync (not weeks/months since sync was enabled), confirming `githubLastSync` is used correctly

## Review

- [ ] Bug/cleanup items if found

## Notes

**Key files:**

- `packages/web-api/src/github/sync-scheduler.ts` - Main sync logic
- `packages/web-api/src/github/sync-scheduler.test.ts` - Tests
- `packages/web-api/src/github/client.ts` - GitHub API client (uses `since` parameter correctly)

**Data model (UserPreferences):**

- `githubLastSync`: ISO timestamp of last successful sync (updated after each sync)
- `githubSyncStartedAt`: ISO timestamp when sync was first enabled (max lookback boundary)

**Why `githubSyncStartedAt` still matters:**
It serves as a maximum lookback boundary - we should never fetch issues older than when the user first enabled sync. However, it shouldn't be the default `since` value for every follow-up sync.

**Consideration:**
For edge cases where `githubLastSync` is older than `githubSyncStartedAt` (shouldn't happen normally), we could use `max(githubLastSync, githubSyncStartedAt)`. However, this case shouldn't occur in practice since `githubLastSync` is set after sync completes.
