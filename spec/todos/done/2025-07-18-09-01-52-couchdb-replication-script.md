# create a script (pnpm replicate db1 db2) that allows to replicate one couchdb into another

**Status:** Done
**Created:** 2025-07-18T09:01:52
**Started:** 2025-07-18T09:04:31
**Agent PID:** 83254

## Original Todo

create a script (pnpm replicate db1 db2) that allows to replicate one couchdb into another

## Description

The task is to create a TypeScript-based CouchDB replication script that enables one-way synchronization from a source database to a target database using the command: `pnpm replicate db1 db2`. This script will **add/update** documents from the source to the target without removing existing documents in the target database. 

The script will use the `nano` library's built-in replication functionality (`nano.db.replicate()`) which is already a dependency in the project. This ensures proper conflict resolution and document versioning while maintaining consistency with the existing codebase.

Key features:
- One-way sync that preserves existing target data
- Uses nano's replication API for reliability
- TypeScript implementation following project conventions
- Integrates with existing configuration and authentication
- Provides progress feedback and error handling

Use cases:
- Merging data from multiple databases
- Adding production data to a development database
- Consolidating user databases
- Incremental data synchronization

## Implementation Plan

- [x] Create `scripts/replicate.ts` with nano replication functionality (scripts/replicate.ts:1-120)
- [x] Create `scripts/replicate-interactive.ts` for interactive mode (scripts/replicate-interactive.ts:1-100)
- [x] Add shared utilities for replication in `scripts/backup-utils.ts` (scripts/backup-utils.ts:200-250)
- [x] Update package.json with new scripts (package.json:40-41)
- [x] Automated test: Create unit tests for replication logic (scripts/__tests__/replicate.test.ts)
- [x] Automated test: Verify replication doesn't delete target data
- [x] User test: Run `pnpm replicate source-db target-db` with test databases
- [x] User test: Run `pnpm replicate:interactive` and verify UI flow
- [x] User test: Verify target database preserves existing documents after replication

## Notes

Implementation completed successfully. The replication scripts use nano's built-in replication functionality with the following features:

- **One-way sync**: Only copies from source to target, preserves target data
- **Automatic target creation**: Creates target database if it doesn't exist
- **Progress feedback**: Shows document counts and replication statistics
- **Error handling**: Graceful handling of connection and authentication errors
- **Interactive mode**: User-friendly CLI with database discovery
- **Continuous replication**: Optional --continuous flag for ongoing sync
- **Safety checks**: Validates source existence before proceeding
- **Comprehensive tests**: Unit tests verify functionality and data preservation
- **Fixed help command**: Environment validation now only occurs during actual replication, not when showing help