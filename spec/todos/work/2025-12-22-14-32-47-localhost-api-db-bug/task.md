# Fix localhost hardcoded URL bug in cross-machine API access

**Status:** Refining
**Created:** 2025-12-22-14-32-47
**Agent PID:** 98482

## Description

When accessing the web application from another machine on the network (e.g., http://192.168.1.203:3000), the PouchDB sync fails because the remote database URL is hardcoded as `http://localhost:3000/api/db` in `use_couchdb_sync.ts:24`. This causes the browser to attempt connecting to localhost instead of the actual server IP address.

**Success criteria:**

- User can access the app from any machine on the network using the server's IP address
- PouchDB sync works correctly regardless of how the app is accessed (localhost, LAN IP, domain name)
- No hardcoded localhost URLs in the codebase
- All other API calls continue to work (they already use relative URLs correctly)

## Implementation Plan

- [ ] Replace hardcoded `http://localhost:3000/api/db` with dynamic URL using `window.location.origin` (packages/web-client/src/hooks/use_couchdb_sync.ts:24)
- [ ] Verify no other hardcoded localhost URLs exist in web-client
- [ ] Automated test: Add unit test for URL construction
- [ ] User test: Start server with `pnpm dev`, access from another machine on network, verify sync works
- [ ] User test: Access from localhost, verify sync still works

## Review

## Notes
