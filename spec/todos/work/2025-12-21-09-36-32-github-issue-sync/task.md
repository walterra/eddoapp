# GitHub issue sync

**Status:** In Progress
**Created:** 2025-12-21-09-36-32
**Started:** 2025-12-21-09-57-48
**Agent PID:** 98482

## Description

**What we're building:**
One-way periodic sync of a user's GitHub issues into Eddo as todos, tracked via `externalId` to prevent duplicates. Users provide a GitHub Personal Access Token (PAT) with `repo` scope to enable syncing of both public and private repository issues.

**How we'll know it works:**

1. User can configure GitHub PAT via Telegram bot or web UI
2. Sync runs periodically (configurable interval, default 1 hour)
3. GitHub issues appear as Eddo todos with `externalId: "github:owner/repo/issues/123"`
4. Re-syncs don't create duplicates (deduplication via externalId)
5. Updated issues sync changes (title, description, labels, state)
6. Closed GitHub issues mark Eddo todos as completed
7. Manual sync trigger available via MCP tool
8. Logs show sync activity and error handling

**Technical approach:**

- GitHub REST API `GET /user/issues` endpoint (requires PAT authentication)
- Scheduler service in telegram_bot package (pattern from DailyBriefingScheduler)
- User preferences extended with GitHub sync settings
- TodoAlpha3 `externalId` field (already implemented)
- Telegram bot commands for manual sync and configuration

## Implementation Plan

### Phase 1: Data Model & Configuration (packages/core-shared)

- [x] Add GitHub preferences to UserPreferences interface (packages/core-shared/src/versions/user_registry_alpha2.ts)
  - githubSync: boolean
  - githubToken: string | null (encrypted in production)
  - githubSyncInterval: number (minutes, default 60)
  - githubSyncContext: string (which context to assign synced issues, default "work")
  - githubSyncTags: string[] (tags to add to synced issues, default ["github"])
- [x] Automated test: Verify UserPreferences type includes GitHub fields

### Phase 2: GitHub API Integration (packages/web-api/src/github)

- [x] Create github/client.ts with factory function createGithubClient({ token })
  - fetchUserIssues() returns array of GitHub issue objects
  - mapIssueToTodo() converts GitHub issue to TodoAlpha3 structure
  - generateExternalId() creates consistent ID format
  - Handle pagination for users with 100+ issues
  - Handle rate limiting (5000 req/hr authenticated)
- [x] Automated test: Mock GitHub API responses, verify issue mapping
- [x] Automated test: Verify externalId format consistency
- [x] Automated test: Verify pagination handling

### Phase 3: Sync Scheduler Service (packages/web-api/src/github)

- [x] Create github-sync-scheduler.ts following DailyBriefingScheduler pattern
  - GithubSyncScheduler class with start()/stop() methods
  - Check interval configurable per user
  - Fetch issues via GitHub client
  - Query existing todos by externalId to detect duplicates
  - Create new todos for new issues
  - Update existing todos if GitHub issue changed
  - Mark todos completed if GitHub issue closed
  - Error handling with retry logic
  - Logging for sync activity
- [x] Automated test: Mock sync cycle, verify deduplication
- [x] Automated test: Verify update detection logic
- [x] Automated test: Verify closed issue handling
- [ ] User test: Enable sync via bot, verify issues appear in web UI
- [ ] User test: Close GitHub issue, verify Eddo todo marked complete
- [ ] User test: Update GitHub issue title, verify Eddo todo updates

### Phase 4: Telegram Bot Integration (packages/telegram_bot/src/bot)

- [x] Add /github command with subcommands (on/off/token/status)
- [x] Security: Auto-delete messages containing tokens
- [x] Security: Mask token in logs (show first 7 and last 4 chars)
- [x] Token validation (check ghp* or github_pat* prefix)
- [x] Register command in bot index.ts
- [ ] Automated test: Mock bot commands, verify preference updates
- [ ] User test: Configure GitHub sync via bot commands
- [ ] User test: View sync status and settings

**Note:** Manual sync trigger (`/github sync`) removed - automatic sync runs via scheduler only

### Phase 5: Security & Error Handling

- [x] Validate GitHub token format before saving
- [x] Mask token in logs (show first 7 and last 4 chars)
- [x] Handle GitHub API errors (401, 403, 404)
- [x] Handle rate limit errors with helpful messages
- [x] Handle network timeouts and connection errors
- [x] Automated test: Verify token masking in logs
- [x] Automated test: Verify error handling for invalid tokens
- [x] Automated test: Verify rate limit error detection
- [ ] User test: Enter invalid token, verify clear error message

### Phase 6: Documentation & Polish

- [x] Update README.md with GitHub sync feature
- [x] Update CLAUDE.md with architecture details
- [x] Add JSDoc to all public functions
- [x] Add user guide in bot help text (/github command)
- [x] Update .env.example (not needed - user-level config only)
- [ ] User test: Follow setup guide from README, verify success

## Review

[To be filled during review phase]

## Notes

### Architecture Decision: web-api vs telegram_bot

- Moved GitHub client from `packages/telegram_bot` to `packages/web-api`
- Rationale: GitHub sync is a general integration feature, not Telegram-specific
- Benefits: Can be used by web UI, Telegram bot, and other clients
- Scheduler will also live in web-api for better reliability (runs when API server runs)

### Design Decisions

**Initial Sync: Open Issues Only**:

- First sync (when `githubLastSync` is undefined) fetches only **open** issues
- Rationale: Avoid cluttering todos with hundreds of old closed issues

**Max Lookback Date (`githubSyncStartedAt`)**:

- Set when user first enables sync
- Subsequent syncs use `since` parameter to only fetch issues updated after this timestamp
- Prevents syncing ancient closed issues from years ago
- Still detects when currently tracked issues get closed
- Example: Sync enabled on Dec 20 → only syncs issues updated since Dec 20, not from 2020

### Code Quality Improvements

**Proper Test Architecture**:

- Extracted private methods into separate testable utility functions
- Created `sync-utils.ts` with `shouldSyncUser()` and `findTodoByExternalId()`
- Eliminated need for `as any` type assertions in tests
- Tests use proper TypeScript types with `Parameters<typeof fn>[0]` for type-safe mocking
- Improved maintainability: utility functions are independently testable

### Bugs Fixed

**User Cache Stale Data Bug**:

- **Issue**: After setting GitHub token via `/github token`, running `/github on` immediately would fail with "token not set" error
- **Root Cause**: `lookupUserByTelegramId()` caches user data for 5 minutes. After updating preferences, cache still had old data without the token
- **Fix**: Added `invalidateUserCache()` function and call it after every user preference update
- **Files Modified**:
  - `packages/telegram_bot/src/utils/user-lookup.ts` - Added cache invalidation function
  - `packages/telegram_bot/src/bot/commands/github.ts` - Call invalidation after updates

### Implementation Summary

**Files Created:**

- `packages/web-api/src/github/client.ts` - GitHub API client with Octokit (165 lines)
- `packages/web-api/src/github/types.ts` - GitHub API type definitions (47 lines)
- `packages/web-api/src/github/sync-scheduler.ts` - Periodic sync scheduler (280 lines)
- `packages/web-api/src/github/sync-utils.ts` - Testable utility functions (55 lines)
- `packages/telegram_bot/src/bot/commands/github.ts` - Telegram bot commands (353 lines)
- `packages/core-shared/src/versions/user_registry_alpha2.test.ts` - User preferences tests (90 lines)
- `packages/web-api/src/github/client.test.ts` - Client tests (165 lines)
- `packages/web-api/src/github/sync-scheduler.test.ts` - Scheduler tests (95 lines)
- `packages/web-api/src/github/sync-utils.test.ts` - Utility function tests (140 lines)
- `packages/web-api/src/github/error-handling.test.ts` - Error handling tests (175 lines)

**Files Modified:**

- `packages/core-shared/src/versions/user_registry_alpha2.ts` - Added GitHub preferences (7 fields)
- `packages/web-api/src/index.ts` - Integrated GitHub sync scheduler
- `packages/web-api/src/github/sync-scheduler.ts` - Max lookback date support
- `packages/telegram_bot/src/index.ts` - Registered /github command
- `packages/telegram_bot/src/bot/commands/github.ts` - Set githubSyncStartedAt on enable
- `packages/telegram_bot/src/utils/user-lookup.ts` - Added cache invalidation
- `README.md` - Documented GitHub sync feature
- `CLAUDE.md` - Added architecture documentation

**Test Coverage:**

- ✅ 457 total tests passing (34 test files)
- ✅ User preferences validation
- ✅ GitHub issue to todo mapping
- ✅ External ID generation
- ✅ Deduplication logic
- ✅ Update detection
- ✅ Error handling (401, 403, 404, rate limits)
- ✅ Token masking and validation
- ✅ Scheduler lifecycle (start/stop)
- ✅ Initial sync vs subsequent sync behavior
- ✅ User cache invalidation after updates

**Build Status:**

- ✅ All packages compile successfully
- ✅ No TypeScript errors
- ✅ Linting passes (warnings are pre-existing)
- ✅ Code formatted with Prettier

**Dependencies Added:**

- `@octokit/rest` ^22.0.1 (web-api package)

**User Tests Remaining:**

- Manual testing of Telegram bot commands
- Verification of GitHub issue sync in web UI
- Testing with actual GitHub API and PAT
- Validation of sync interval and deduplication
