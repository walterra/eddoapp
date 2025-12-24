# Support backup/restore functionality - GitHub Issue #13

**Status:** Done
**Created:** 2025-12-24-23-56-08
**Started:** 2025-12-25-00:00
**Agent PID:** 37321

## Description

Implement Phase 2: Automated Backup System for CouchDB. Core manual backup/restore is complete (Phase 1). This adds scheduled automated backups with retention policy management.

### Success Criteria

- Automated daily backups run without manual intervention
- Retention policy enforces storage limits (30 days daily, 12 weeks weekly, 12 months monthly)
- Backup health checks verify backup integrity
- RPO < 24 hours achieved through daily automation

## Implementation Plan

### 1. Create Backup Scheduler Service

- [x] `scripts/backup-scheduler.ts` - Scheduler that runs backups on configurable intervals
- [x] Support for cron-like scheduling (daily at specific time)
- [x] Configurable via environment variables (BACKUP_SCHEDULE, BACKUP_DIR, etc.)
- [x] Graceful shutdown handling
- [x] Fixed glob pattern matching bug (regex escaping order)

### 2. Implement Retention Policy Manager

- [x] `scripts/backup-retention.ts` - Manages backup file lifecycle
- [x] Daily backups: keep for 30 days
- [x] Weekly backups: keep oldest daily from each week for 12 weeks
- [x] Monthly backups: keep oldest weekly from each month for 12 months
- [x] Dry-run mode for testing policy before deletion

### 3. Add Automated Backup Verification

- [x] Updated `verify-backup.ts` to understand @cloudant/couchbackup format
- [x] Scheduler runs verification after each automated backup
- [x] Log verification results with document counts
- [x] Distinguish design docs vs todo docs

### 4. Create pnpm Scripts

- [x] `pnpm backup:auto` - Run backup scheduler (foreground)
- [x] `pnpm backup:retention` - Apply retention policy
- [x] `pnpm backup:retention --dry-run` - Preview retention actions

### 5. Add Configuration

- [x] Document environment variables in CLAUDE.md

### 6. Testing

- [x] Unit tests for retention policy logic (9 tests)
- [x] Unit tests for scheduler timing calculations (8 tests)
- [x] Manual testing of backup + verify + retention flow

## Review

- [x] Fixed glob pattern matching - was escaping `.` after converting `*` to `.*`
- [x] Fixed backup verification - now understands couchbackup batched JSON format

## Notes

- Fixed a bug in backup-utils.ts where timestamp format was being corrupted
- Fixed glob pattern matching in scheduler (regex escaping order)
- Updated verify-backup.ts to handle couchbackup's batched JSON format
- Phase 1 (manual backup/restore) remains complete with E2E tests

## Files Changed

- `scripts/backup-scheduler.ts` (new) - Automated backup scheduler service
- `scripts/backup-retention.ts` (new) - Retention policy manager
- `scripts/backup-scheduler.test.ts` (new) - Unit tests for scheduler
- `scripts/backup-retention.test.ts` (new) - Unit tests for retention
- `scripts/verify-backup.ts` (updated) - Fixed couchbackup format support
- `package.json` - Added backup:auto and backup:retention scripts
- `vitest.config.ts` - Added new test files to unit test config
- `CLAUDE.md` - Added backup scheduler documentation
