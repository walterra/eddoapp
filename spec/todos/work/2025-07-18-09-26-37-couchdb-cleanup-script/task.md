# a `pnpm couchdb:cleanup` script that deletes test databases

**Status:** In Progress
**Created:** 2025-07-18T09:26:37Z
**Agent PID:** 83254
**Started:** 2025-07-18T09:26:37Z

## Original Todo

a `pnpm couchdb:cleanup` script that deletes test databases

## Description

Create a `pnpm couchdb:cleanup` script that provides a CLI interface for cleaning up test databases, similar to the replicate script pattern. The script should:

1. **Use nano for CouchDB operations** following the replicate script pattern
2. **Support multiple cleanup modes**: all test databases, specific patterns, age-based cleanup
3. **Include safety features**: dry-run mode, confirmation prompts, environment checks
4. **Use Commander.js + prompts** for CLI interface like the replicate script
5. **Manual HTTP requests** for database discovery and filtering (like replicate script)
6. **Comprehensive error handling** with user-friendly messages

## Implementation Plan

- [x] Create scripts/cleanup-interactive.ts with Commander.js setup (scripts/cleanup-interactive.ts)
- [x] Add database discovery function using fetch API pattern from replicate script (scripts/cleanup-interactive.ts)
- [x] Implement test database filtering logic (eddo_test_*, test-*, todos-test*) (scripts/cleanup-interactive.ts)
- [x] Add interactive prompts for cleanup mode selection (scripts/cleanup-interactive.ts)
- [x] Implement dry-run mode with database listing (scripts/cleanup-interactive.ts)
- [x] Add confirmation prompts before deletion (scripts/cleanup-interactive.ts)
- [x] Use nano for actual database deletion operations (scripts/cleanup-interactive.ts)
- [x] Add comprehensive error handling and user feedback (scripts/cleanup-interactive.ts)
- [x] Add package.json scripts for couchdb:cleanup (package.json)
- [ ] Automated test: verify script handles non-existent databases gracefully
- [ ] Automated test: verify dry-run mode doesn't delete databases
- [ ] Automated test: verify test database filtering works correctly
- [ ] User test: Run script with dry-run mode and verify output
- [ ] User test: Create test database and verify cleanup works
- [ ] User test: Verify confirmation prompts work correctly

## Notes

**Implementation Complete:** 
- Created scripts/cleanup-interactive.ts following the replicate script pattern
- Uses Commander.js for CLI options and prompts for interactive selection
- Implements database discovery via fetch API (like replicate script)
- Uses nano for actual database deletion operations
- Includes comprehensive error handling with user-friendly messages
- Added safety features: dry-run mode, confirmation prompts, test database filtering
- Supports multiple cleanup modes: all test databases, pattern matching, custom selection
- Added `pnpm couchdb:cleanup` script to package.json
- All lint and TypeScript checks pass

**Key Features:**
- Test database pattern matching: `eddo_test_*`, `test-*`, `todos-test*`, `test_*`
- Interactive database selection with multiselect prompts
- Dry-run mode shows what would be deleted without actually deleting
- Confirmation prompts before deletion (unless --force flag used)
- Graceful error handling and user cancellation support
- Comprehensive logging and progress indicators with ora spinners
- Auto-detects mode based on options (--pattern sets mode to pattern, --databases sets mode to custom)
- Proper glob-to-regex conversion for pattern matching (test-* only matches test-something, not todos-test_something)

**CLI Options Analysis - Inconsistencies Found:**

After comparing backup and replicate scripts' CLI options, several inconsistencies were identified:

**Critical Issue - Flag Conflicts:**
- **Backup script**: `-t, --timeout <ms>` (timeout in milliseconds)
- **Replicate script**: `-t, --target <database>` (target database name)
- **Problem**: Same short flag `-t` has different meanings across scripts

**Missing Options:**
- **Replicate script missing**: `--dry-run`, `--no-interactive`, `--timeout`, `--parallelism`
- **Backup script missing**: N/A (specific to backup functionality)

**Recommendations:**
1. **Fix flag conflict**: Remove `-t` short flag from backup script's timeout option
2. **Add missing options**: Add `--dry-run`, `--no-interactive`, `--timeout` to replicate script
3. **Standardize patterns**: Both scripts should support consistent interactive/non-interactive modes

**Current Cleanup Script Status:**
- ✅ Follows good CLI patterns with `--dry-run` and `--no-interactive` equivalent (`--force`)
- ✅ Uses consistent flag naming conventions
- ✅ Provides comprehensive help documentation
- ✅ Auto-detects mode based on provided options
- ✅ **FIXED**: Now uses `COUCHDB_URL` environment variable like other scripts (removed `--db` CLI option)
- ✅ **CONSISTENT**: Uses `validateEnv()` and `getCouchDbConfig()` for configuration like backup/replicate scripts