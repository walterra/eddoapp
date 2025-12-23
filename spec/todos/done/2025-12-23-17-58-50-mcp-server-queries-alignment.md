# MCP Server queries/views alignment

**Status:** Done
**Created:** 2025-12-23-17-58-50
**Started:** 2025-12-23-18-02-51
**GitHub Issue:** https://github.com/walterra/eddoapp/issues/299
**Agent PID:** 37321

## Description

Align MCP server database setup with the shared `REQUIRED_INDEXES` from `@eddo/core-shared`. The MCP server's `DatabaseSetup.createIndexes()` method is missing two indexes that are defined in the shared module and used by the application:

1. `externalId-index` - Used for GitHub issue sync deduplication
2. `tags-index` - Used for tag-based queries (e.g., fetching user memories)

**Success criteria:**

- MCP server's `DatabaseSetup` uses `REQUIRED_INDEXES` from `@eddo/core-shared` (DRY principle)
- All indexes are created consistently across web-client, web-api, and mcp-server
- Existing integration tests pass

## Implementation Plan

- [x] Update `packages/mcp_server/src/integration-tests/setup/database-setup.ts` to use `REQUIRED_INDEXES` from `@eddo/core-shared` instead of duplicating index definitions
- [x] Remove duplicated index definitions from MCP server database-setup
- [x] Verify MCP server integration tests pass (requires running CouchDB)
- [x] Run unit test suite (462 tests pass)
- [x] TypeScript check passes
- [x] Lint passes (no errors)

## Review

- [x] Confirm no duplicate code remains
- [x] Verify all packages use the same shared definitions
- [x] Code change is minimal and focused (removed ~45 lines of duplicated code)

## Notes

### Current State Analysis

**Shared definitions in `core-shared/src/api/database-structures.ts`:**

- `DESIGN_DOCS`: 4 design documents (todos_by_active, todos_by_due_date, todos_by_time_tracking_active, tags)
- `REQUIRED_INDEXES`: 6 indexes:
  1. `version-due-index`
  2. `version-context-due-index`
  3. `version-completed-due-index`
  4. `version-context-completed-due-index`
  5. `externalId-index` ← MISSING from MCP server
  6. `tags-index` ← MISSING from MCP server

**MCP server `database-setup.ts` issues:**

- Already imports `DESIGN_DOCS` from `@eddo/core-shared` ✓
- Creates its own hardcoded index list with only 4 indexes (missing externalId-index and tags-index)
- Also creates a redundant `simple-due-index` not in the shared definitions

**Web-api `setup-user-db.ts`:**

- Uses both `DESIGN_DOCS` and `REQUIRED_INDEXES` from `@eddo/core-shared` ✓

**Web-client `database_setup.ts`:**

- Uses both `DESIGN_DOCS` and `REQUIRED_INDEXES` from `@eddo/core-shared` ✓

### Query Usage in MCP Server

MCP server uses:

1. **Mango queries** with `use_index` for `listTodos` (uses version-\* indexes)
2. **MapReduce view** for `getActiveTimeTracking` (uses `todos_by_time_tracking_active` design doc)
3. **MapReduce view** for tag stats in `getServerInfo` (uses `tags` design doc)
4. **Mango query** for memories in `getServerInfo` with `use_index: 'tags-index'` ← **Will fail if index missing!**
5. **`externalId` filter** in `listTodos` ← **Needs externalId-index for performance**
