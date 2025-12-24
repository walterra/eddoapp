# PouchDB sync for user_registry database

**Status:** In Progress
**Created:** 2025-12-24-23-11-07
**Started:** 2025-12-24
**Agent PID:** 37321
**GitHub Issue:** #303

## Description

Enable real-time synchronization of user preferences across browser tabs and devices. Currently, `use_profile.ts` fetches preferences via REST API and updates via mutations, requiring manual refetch to see changes. With SSE-based sync:

- Changes in one tab appear immediately in other tabs
- Telegram bot preference updates reflect in web UI without page refresh
- Simple, secure implementation using Hono's built-in `streamSSE`

**Why SSE instead of full PouchDB sync?**

- The `user_registry` database contains ALL users' documents
- Full PouchDB replication would require complex server-side filtering for security
- For a single document (user preferences), SSE is simpler and equally effective
- SSE is 2025 best practice for one-way real-time updates (used by OpenAI, Anthropic APIs)
- Hono already has built-in SSE support - zero new dependencies

**Success criteria:**

1. Preference changes made in one browser tab appear in other tabs within seconds
2. Preference changes made via Telegram bot appear in web UI without manual refresh
3. No regressions in existing preference read/write functionality
4. Secure: users can only receive updates for their own document

## Implementation Plan

### Phase 1: Backend - SSE Endpoint for Registry Changes

- [x] Create SSE endpoint `GET /api/users/preferences/stream` (packages/web-api/src/routes/users.ts)
  - Use Hono's `streamSSE` helper from `hono/streaming`
  - Extract username from JWT token
  - Connect to CouchDB `_changes` feed filtered to `user_{username}` doc only
  - Stream preference updates as SSE events
  - Handle connection abort/cleanup
- [ ] Add automated test for SSE endpoint (deferred - requires integration test setup)

### Phase 2: Client - SSE Hook for Preference Updates

- [x] Create `use_preferences_stream.ts` hook (packages/web-client/src/hooks/)
  - Use native `EventSource` API to connect to `/api/users/preferences/stream`
  - On message: update React Query cache for `['profile']` key
  - Handle reconnection (built-in with EventSource)
  - Clean up on unmount
- [x] Integrate hook into authenticated app (call from `PreferencesStreamProvider` in eddo.tsx)
- [x] Add automated test for SSE hook (6 tests in use_preferences_stream.test.tsx)

### Phase 3: Integration & Polish

- [x] Handle auth token in EventSource (using query param approach for HTTPS)
- [ ] Add connection status indicator (optional)
- [x] Ensure SSE connection closes on logout (handled by useEffect cleanup)

### Phase 4: Testing

- [ ] Manual test: Open two browser tabs, change preference in one, verify sync to other
- [ ] Manual test: Change preference via Telegram bot, verify web UI updates
- [ ] Verify no regressions in login/logout flow
- [ ] Verify SSE reconnects after network interruption

## Review

- [ ] Security review: Confirm users can only receive their own document updates
- [ ] Performance review: Verify SSE connection doesn't leak on tab close/logout

## Notes

**Architecture Decision: SSE over PouchDB Sync**

For syncing a SINGLE document from a shared database, full PouchDB replication is overkill and introduces security complexity. Options considered:

| Option                                | Security    | Complexity | Offline-First |
| ------------------------------------- | ----------- | ---------- | ------------- |
| PouchDB with `doc_ids` client filter  | ❌ Insecure | Low        | ✅ Yes        |
| PouchDB with server-side proxy filter | ✅ Secure   | High       | ✅ Yes        |
| **SSE + REST (chosen)**               | ✅ Secure   | Low        | ❌ No         |

SSE chosen because:

- Server controls what it sends (secure by design)
- Hono has built-in `streamSSE` (zero dependencies)
- 2025 best practice for one-way real-time (LLM streaming, notifications)
- Preferences aren't critical for offline use (todos are)
- Much simpler implementation

**Key Files:**

- `packages/web-api/src/routes/users.ts` - Add SSE endpoint here
- `packages/web-client/src/hooks/use_profile.ts` - Current profile hook
- `packages/web-client/src/hooks/use_database_changes.tsx` - Pattern to follow for React integration

**EventSource Auth Consideration:**
Native `EventSource` doesn't support custom headers. Options:

1. Pass token as query param: `/api/users/preferences/stream?token=xxx` (simple but less secure)
2. Use `event-source-polyfill` package for header support
3. Use cookie-based auth for SSE endpoint only

Will evaluate during implementation - option 1 is acceptable for MVP since connection is already over HTTPS.

**CouchDB Changes Feed:**

```typescript
// Server-side: nano library supports changes feed
const changes = userRegistryDb.changesReader.start({
  doc_ids: [`user_${username}`],
  includeDocs: true,
  since: 'now',
});
```
