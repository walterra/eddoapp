- use @testcontainers for integration/e2e tests

- split up unit tests and integration tests on CI in separate tasks

- **Investigate infinite \_all_docs loop in web-api dev server**: Web-api process gets stuck requesting `_all_docs?include_docs=true` continuously (10-15 req/sec), causing CouchDB to consume 900%+ CPU. Happened 2025-12-18 with process 7639 making 172+ requests in 200 log lines. Possible causes: PouchDB replication/sync issue, React infinite re-render triggering database queries, or changes feed listener gone wild. Add monitoring/detection and fix root cause in web-client or web-api code.

- **Selective GitHub Force Resync**: Replace single "Force Resync" button with modal for fine-grained field selection
  - **Use case:** Resync only tags without overwriting user-adjusted due dates or context
  - **UI Flow:**
    1. Click "Force Resync" button → modal appears
    2. Checkboxes for fields to resync:
       - ☑️ Tags (GitHub labels) - default checked
       - ☑️ Title - default checked
       - ☑️ Description - default checked
       - ☑️ Status (open/closed) - default checked
       - ☐ Due date - default unchecked (preserve user adjustments)
       - ☐ Context - default unchecked (preserve user assignments)
    3. "Resync Selected Fields" button
  - **Backend changes:**
    - Add `resyncFields: string[]` parameter to `/api/users/github-resync` endpoint
    - Update `processIssue()` in sync-scheduler.ts to selectively merge fields
    - Preserve unchanged fields from existing todo (don't overwrite with GitHub data)
  - **Testing:**
    - User adjusts due date, resyncs tags only → due date unchanged
    - User changes context, resyncs all → context reset to GitHub repo name
    - All field combinations work correctly

- Add PouchDB sync for user_registry database (real-time preference updates across tabs/devices)
  - Create `/api/registry` proxy endpoint with filtered replication (user sees only their own doc)
  - Add second PouchDB instance in web-client for user_registry
  - Extend DatabaseChangesProvider to listen to both databases (todos + registry)
  - Update `use_profile.ts` to read/write directly to PouchDB instead of REST API
  - Enables: multi-tab sync, cross-device sync, Telegram bot preference updates reflected in web UI

- proper timezone support

- the gtd tags like `gtd:next` should be a `gtd` attribute on todos just like context and be stored just `next`, will trigger creating TodoAlpha5
- peristent chat history for telegram-bot
- chat interface in the web-ui
- eddo*user_registry is the couchdb user registry. eddo_user*\* are the todos for each user. looks like a prefix naming clash. what if someone registered with a username "registry"?
- **ADD ERROR HANDLING**: Implement Stoker middleware for consistent error responses https://github.com/w3cj/stoker
- **OPTIMIZE PERFORMANCE**: Add proper caching headers and asset optimization

## E2E Test Flakiness & Stream Handling Issues

### Critical: Fix Backup/Restore Stream Management

**Context:** E2E tests for backup-interactive.ts fail intermittently in CI due to improper stream handling and timeout management. Quick fix applied: increased test timeouts from 30s to 60s.

**Root Causes:**

1. WriteStream never explicitly closed or error-handled in backup operations
2. ReadStream in restore operations lacks proper error handling
3. No timeout guards around Promise wrappers for couchbackup callbacks
4. Orphaned setInterval when backup Promise times out before callback fires
5. No verification that streams finish/close successfully

**Proper Fixes Required:**

Files affected:

- `scripts/backup-interactive.ts` (lines 220-280)
- `scripts/restore-interactive.ts` (similar patterns)

```typescript
// Add to backup-interactive.ts
const writeStream = fs.createWriteStream(backupFile);

// 1. Add stream error handler
writeStream.on('error', (err) => {
  clearInterval(updateProgress);
  reject(err);
});

// 2. Add timeout guard (buffer beyond requestTimeout)
const timeoutId = setTimeout(() => {
  clearInterval(updateProgress);
  writeStream.destroy();
  reject(new Error(`Backup timed out after ${config.timeout}ms`));
}, config.timeout + 5000);

// 3. Ensure cleanup in Promise
await new Promise<void>((resolve, reject) => {
  const backup = couchbackup.backup(dbUrl, writeStream, options, (err) => {
    clearInterval(updateProgress);
    clearTimeout(timeoutId);
    if (err) reject(err);
    else resolve();
  });

  backup.on('changes', (batch) => {
    documentsProcessed += batch;
  });
});

// 4. Wait for stream to finish
await new Promise((resolve, reject) => {
  writeStream.on('finish', resolve);
  writeStream.on('error', reject);
  writeStream.end();
});
```

**Alternative:** Use `stream.pipeline()` for automatic error propagation and cleanup

**Testing:**

- Add unit tests for stream error scenarios
- Add integration tests with artificial timeouts
- Consider `retry: 2` in CI config for e2e tests

## Follow-up Items from /briefing recap Implementation

### High Priority

- Fix timezone handling in recap date calculations (briefing.ts:25-33) - Currently uses local time, should use UTC or user timezone
- Add empty results handling to recap prompt - Provide guidance when no todos completed today
- Verify index selection logic for completion date ranges (mcp-server.ts:398-409) - May need optimization

### Code Quality & Testing

- Update help text to explain automatic recap scheduling (briefing.ts:87)
- Add validation that completedFrom < completedTo in MCP tool
- Fix or remove two-message pattern instruction (doesn't work with current agent implementation)
- Add Zod datetime validation for date parameters in MCP tool
- Add test for `completed: true` + date range combination
- Update test fixtures to include `printBriefing`/`printRecap` fields

### Aspirational Code Quality Standards

These are quality improvements to consider for future development:

- Result/Either pattern for functional error handling
- Structured logging with correlation IDs
- AbortController signal handling for cancellable async operations
- Integration tests with TestContainers for external dependencies
- Property-based testing with fast-check for edge cases
- OpenTelemetry spans with proper error recording and semantic conventions
- Graceful shutdown with cleanup hooks
