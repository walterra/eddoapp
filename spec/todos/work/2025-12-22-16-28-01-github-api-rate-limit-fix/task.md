# GitHub API Rate Limit Handling

**Status:** In Progress
**Created:** 2025-12-22-16-28-01
**Started:** 2025-12-22-21:57:00
**Agent PID:** 98482

## Description

Implement comprehensive GitHub API rate limit handling to prevent "Error: GitHub API rate limit exceeded" errors and provide better user experience when rate limits are approached or exceeded.

**Current Issues:**

- Generic error message with no guidance on when to retry
- No visibility into rate limit status (remaining requests, reset time)
- No automatic retry logic when limits are hit
- No proactive warnings before hitting limits
- No request throttling to prevent hitting limits

**Solution:**

- Extract rate limit headers from GitHub API responses (x-ratelimit-remaining, x-ratelimit-reset, x-ratelimit-limit)
- Implement automatic retry with exponential backoff when rate limits are hit
- Add rate limit monitoring and proactive warnings (log when <20% requests remain)
- Implement request throttling/queueing to prevent rapid successive calls
- Show detailed error messages with reset time in human-readable format
- Update UI to display rate limit info and better error messages

**Success Criteria:**

- Users see exact reset time when rate limit is hit (e.g., "Rate limit exceeded. Try again at 3:45 PM")
- Automatic retry after rate limit reset (with backoff)
- Logs show rate limit warnings before hitting 0 requests remaining
- Manual sync operations respect rate limits and queue requests
- All automated tests pass
- User can see rate limit status in UI when sync fails

## Implementation Plan

- [ ] Create rate limit types and utilities (packages/web-api/src/github/rate-limit.ts)
  - RateLimitInfo interface (limit, remaining, reset, resetDate)
  - extractRateLimitHeaders() function
  - isRateLimitError() type guard
  - formatResetTime() for human-readable time
  - shouldWarnAboutRateLimit() (threshold check)

- [ ] Create rate limit manager with retry and throttling (packages/web-api/src/github/rate-limit-manager.ts)
  - RateLimitManager class with request queue
  - Automatic retry with exponential backoff (maxRetries: 3, baseDelayMs: 1000)
  - Request throttling (minRequestIntervalMs: 100)
  - Proactive rate limit monitoring
  - executeWithRateLimit() wrapper for API calls

- [ ] Update GitHub client to use rate limit handling (packages/web-api/src/github/client.ts:200-250)
  - Integrate RateLimitManager into createGithubClient
  - Extract rate limit headers from all API responses
  - Log rate limit info after each request
  - Wrap fetchAllPagesForQuery with rate limit retry logic
  - Update error messages to include reset time
  - Add rate limit warnings when <20% remain

- [ ] Update sync scheduler to handle rate limit errors (packages/web-api/src/github/sync-scheduler.ts:180-250)
  - Catch rate limit errors in syncUserIssues
  - Log rate limit details for debugging
  - Return graceful error message instead of generic failure
  - Store last rate limit error in user preferences for UI display

- [ ] Update API endpoint error handling (packages/web-api/src/routes/users.ts:406-432)
  - Parse rate limit errors from scheduler
  - Return structured error response with reset time
  - Include rate limit info in JSON response
  - Log rate limit events for monitoring

- [ ] Update UI to show rate limit information (packages/web-client/src/components/user_profile.tsx:272-310)
  - Parse structured error responses from API
  - Display human-readable reset time
  - Show helpful message about rate limits
  - Add rate limit status display (if available)
  - Disable resync button during rate limit cooldown

- [ ] Add unit tests for rate limit utilities (packages/web-api/src/github/rate-limit.test.ts)
  - Test extractRateLimitHeaders with various response formats
  - Test formatResetTime with different timezones
  - Test isRateLimitError type guard
  - Test shouldWarnAboutRateLimit thresholds

- [ ] Add unit tests for rate limit manager (packages/web-api/src/github/rate-limit-manager.test.ts)
  - Test request queueing and throttling
  - Test exponential backoff retry logic
  - Test rate limit warning triggers
  - Test error propagation

- [ ] Add integration tests for client rate limiting (packages/web-api/src/github/client.test.ts)
  - Mock GitHub API with rate limit headers
  - Test automatic retry on 403 rate limit error
  - Test proactive warnings when limits are low
  - Test error message formatting

- [ ] Update documentation
  - Add rate limit section to CLAUDE.md
  - Document rate limit configuration options
  - Add troubleshooting guide for rate limit errors

- [ ] Manual testing: Trigger rate limit scenario
  - Set up test with multiple rapid syncs
  - Verify automatic retry works
  - Verify error messages show reset time
  - Verify UI updates appropriately
  - Verify logs show rate limit warnings

## Review

[To be filled during review phase]

## Notes

**GitHub API Rate Limits:**

- Search API: 30 requests/minute (authenticated)
- REST API: 5,000 requests/hour (authenticated)
- Rate limit headers: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset (Unix timestamp)

**Current Code Locations:**

- GitHub client: packages/web-api/src/github/client.ts (361 lines)
- Sync scheduler: packages/web-api/src/github/sync-scheduler.ts (380 lines)
- API route: packages/web-api/src/routes/users.ts (lines 406-432)
- UI component: packages/web-client/src/components/user_profile.tsx (lines 272-310)

**Key Design Decisions:**

- Use factory pattern for RateLimitManager (not class-based OOP)
- Implement exponential backoff: delay = baseDelay \* 2^(retryCount-1)
- Warning threshold: 20% of limit remaining
- Request throttling: minimum 100ms between requests
- Store rate limit errors in user preferences for UI display
