# The github sync should consider pr reviews assigned to the user

**Status:** In Progress
**Created:** 2025-12-22-10-59-46
**Started:** 2025-12-22T21:59:00Z
**Agent PID:** 98482

## Description

Enhance GitHub sync to include pull requests (both assigned to user and awaiting user's review), not just issues.

**Current Behavior:**

- Syncs only GitHub issues assigned to user (`is:issue assignee:@me`)
- Explicitly filters out ALL pull requests in client.ts:~165
- Creates todos from issues with context set to repository name

**New Behavior:**

- Fetch PRs assigned to user (`is:pr assignee:@me`) - treat like regular tasks
- Fetch PRs awaiting user's review (`is:pr review-requested:@me`) - mark with 'pr-review' tag
- Remove the filter that excludes all PRs
- Handle PR states: open, merged, closed
- Sync issues, assigned PRs, and PR reviews in a single operation

**Success Criteria:**

- PRs assigned to user appear as todos (same as issues)
- PRs awaiting user's review appear as todos with 'pr-review' tag
- PR todos update when merged/closed
- Existing issue sync continues to work unchanged
- Tests verify issues, assigned PRs, and PR reviews are all synced correctly

## Implementation Plan

- [x] Remove pull_request filter that excludes all PRs (packages/web-api/src/github/client.ts:~165)
- [x] Update buildSearchQuery to support fetching assigned PRs (packages/web-api/src/github/client.ts:~95)
- [x] Add separate search for PR reviews: `is:pr review-requested:@me` (packages/web-api/src/github/client.ts:~110-130)
- [x] Extend mapIssueToTodo to conditionally add 'pr-review' tag (packages/web-api/src/github/client.ts:~40)
  - Add tag when PR has user as reviewer (not just assignee)
- [x] Update fetchUserIssues to combine: issues, assigned PRs, and PR reviews (packages/web-api/src/github/client.ts:~200)
  - Deduplicate results (a PR can be both assigned AND awaiting review)
- [x] Handle PR completion states: merged or closed (packages/web-api/src/github/sync-scheduler.ts:~250)
- [x] Automated test: Verify PR filter is removed (packages/web-api/src/github/client.test.ts)
- [x] Automated test: Test assigned PR mapping (no pr-review tag) (packages/web-api/src/github/client.test.ts)
- [x] Automated test: Test PR review mapping (with pr-review tag) (packages/web-api/src/github/client.test.ts)
- [x] Automated test: Test deduplication of PR that's both assigned and review-requested (packages/web-api/src/github/client.test.ts)
- [x] Automated test: Test combined sync of all three types (packages/web-api/src/github/sync-scheduler.test.ts)
- [ ] User test: Enable GitHub sync with assigned issue, assigned PR, and PR review
- [ ] User test: Verify all three appear as separate todos with correct tags
- [ ] User test: Merge/close a PR, verify todo completes automatically
- [ ] User test: Force resync, verify no duplicates created

## Implementation Summary

Code changes implemented successfully:

1. **Removed PR filter** - PRs are no longer excluded from sync (client.ts:~167)
2. **Split search queries** - Created `buildAssignedQuery()` and `buildReviewRequestedQuery()` to fetch:
   - Assigned items (issues + PRs): `assignee:@me`
   - PR reviews: `is:pr review-requested:@me`
3. **Updated fetchUserIssues** - Now fetches both queries and combines results with deduplication
4. **Added isReviewRequested flag** - GithubIssue type extended to mark PR reviews
5. **Enhanced mapIssueToTodo** - Automatically adds type-specific tags:
   - Issues → `github:issue`
   - Assigned PRs → `github:pr`
   - PR reviews → `github:pr-review`
6. **Added tests** - 5 new test cases covering PR review tagging logic

All automated tests pass (15/15 GitHub client tests, 514 total tests)

**Tagging Scheme:**

- All synced items get user-configured tags (e.g., `github`, `gtd:next`) plus GitHub labels
- Type-specific tags added automatically for filtering:
  - `github:issue` - assigned issues
  - `github:pr` - assigned PRs
  - `github:pr-review` - PR reviews requested from user

## Review

- [ ] Bug/cleanup items if found

## Notes

**Key Files:**

- packages/web-api/src/github/client.ts - GitHub API client, issue fetching
- packages/web-api/src/github/types.ts - Type definitions
- packages/web-api/src/github/sync-scheduler.ts - Periodic sync logic
- packages/web-api/src/github/sync-utils.ts - Utility functions

**GitHub Search API Queries:**

- Current: `is:issue assignee:@me` (excludes all PRs)
- New approach: Three separate searches combined:
  1. `is:issue assignee:@me` - assigned issues
  2. `is:pr assignee:@me` - assigned PRs (work like issues)
  3. `is:pr review-requested:@me` - PR reviews (add 'pr-review' tag)
- Alternative: Single query with OR: `(assignee:@me) OR (is:pr review-requested:@me)`
  - Simpler, fewer API calls
  - Need to detect which PRs are reviews vs assigned after fetching
