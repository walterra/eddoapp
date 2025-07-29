# issue with couchdb connection, after a while the UI stops syncing. suspicion: user stays on the logged in screen while they are really no longer having a session so the couchdb sync stops. sync works again after logging out and logging in.

**Status:** Refining
**Created:** 2025-07-29T10:44:56
**Agent PID:** 68110

## Original Todo

issue with couchdb connection, after a while the UI stops syncing. suspicion: user stays on the logged in screen while they are really no longer having a session so the couchdb sync stops. sync works again after logging out and logging in.

## Description

The CouchDB sync issue occurs because JWT tokens expire after 24 hours, but the client-side application doesn't handle token expiration properly. When a user stays logged in beyond the token expiration time, the PouchDB sync silently fails due to 401/403 authentication errors, but the user remains in an apparently "authenticated" state with sync stopped. The user is unaware that their local changes are no longer syncing to the server until they manually logout and login again.

**Key Problems:**
1. No sync error event handlers to detect authentication failures
2. No client-side token expiration monitoring or automatic refresh
3. Authentication state (`isAuthenticated`) only checks token presence, not validity
4. Sync failures are silent - no user feedback when sync stops
5. Health monitoring doesn't track sync authentication status

## Implementation Plan

**Code Changes:**

- [ ] Add token expiration utilities (packages/core-shared/src/utils/token-utils.ts)
- [ ] Enhance authentication hook (packages/web-client/src/hooks/use_auth.ts)
- [ ] Add sync error handling (packages/web-client/src/hooks/use_couchdb_sync.ts)
- [ ] Extend error types (packages/core-shared/src/types/database-errors.ts)
- [ ] Update error messaging (packages/web-client/src/components/database_error_message.tsx)

**Automated Tests:**

- [ ] Automated test: Token utility tests
- [ ] Automated test: Auth hook tests
- [ ] Automated test: Sync error handling tests

**User Tests:**

- [ ] User test: Session expiration test - Leave app open for 24+ hours, verify automatic logout
- [ ] User test: Sync recovery test - After logout due to expired token, verify sync works after re-login
- [ ] User test: Error messaging test - Verify clear error messages appear when session expires

## Notes