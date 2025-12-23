# Track PR closures for assigned reviewers

**Status:** Done
**Started:** 2025-12-23-17-11-41
**GitHub Issue:** https://github.com/walterra/eddoapp/issues/296
**Created:** 2025-12-23-17-07-47
**Agent PID:** 37321

## Description

**Bug confirmed:** PR reviews imported into Eddo don't get marked as completed when the PR is merged/closed.

**Root Cause:** The GitHub Search API query `review-requested:@me` only matches PRs where the user is **currently** a requested reviewer. Once a PR is merged/closed, GitHub clears the review request status, so the query no longer returns those PRs.

**Example:** PR `github:elastic/kibana/issues/246672` was imported as a review request, but after merge, follow-up syncs can't find it via `review-requested:@me state:all` because the review request was cleared.

**Solution:** Add a second query using `reviewed-by:@me` to catch PRs where the user submitted a review. This captures:

1. PRs where user completed their review (approved, changes requested, commented)
2. These remain findable even after PR closure

**Limitation:** PRs where user was requested but never submitted a review AND got merged won't be found. This is acceptable - the user didn't take action, so manual completion is appropriate.

## Implementation Plan

- [x] Add `buildReviewedByQuery()` function in `client.ts` with query `is:pr reviewed-by:@me`
- [x] Update `fetchUserIssues()` to make a third Search API call for reviewed PRs
- [x] Merge reviewed PRs into results (deduplicate with existing items by ID)
- [x] Mark reviewed PRs with `isReviewRequested: true` flag for `github:pr-review` tag
- [x] Existing unit tests pass (97 tests)
- [x] TypeScript check passes
- [x] Lint check passes
- [x] User test: Verify the kibana PR gets marked completed after sync ✓

## Review

- [x] Code review: Changes are minimal and focused
- [x] Full test suite passes (462 tests)
- [x] No edge cases found - deduplication handles all merge scenarios
- [x] Rate limit consideration documented in notes

## Notes

**GitHub Search API queries for PR involvement:**

- `review-requested:@me` - PRs awaiting your review (cleared on merge)
- `reviewed-by:@me` - PRs you submitted a review on (persists after merge)
- `assignee:@me` - PRs assigned to you (already handled)

**Rate limit consideration:** Adding a third query increases API usage by ~33%. The Search API allows 30 requests/minute, pagination may increase this. Monitor rate limit warnings.
