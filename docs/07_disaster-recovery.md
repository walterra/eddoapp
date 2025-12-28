# Disaster Recovery Guide

This guide covers backup strategy, restore procedures, and recovery objectives for Eddo's CouchDB data.

## Overview

Eddo uses a multi-layer backup strategy:

| Layer                   | Tool                    | Purpose                                       |
| ----------------------- | ----------------------- | --------------------------------------------- |
| **Logical Backup**      | `@cloudant/couchbackup` | Point-in-time JSON backups for recovery       |
| **Automated Scheduler** | `pnpm backup:auto`      | Continuous backup with configurable intervals |
| **Retention Policy**    | `pnpm backup:retention` | Storage management with tiered retention      |
| **Verification**        | `pnpm backup:verify`    | Backup integrity validation                   |

## Recovery Objectives

| Objective                          | Target     | How Achieved                          |
| ---------------------------------- | ---------- | ------------------------------------- |
| **RPO** (Recovery Point Objective) | < 24 hours | Automated daily backups via scheduler |
| **RTO** (Recovery Time Objective)  | < 4 hours  | Restore procedures documented below   |

### RTO Considerations

Restore time depends on:

- Database size and document count
- Network latency to CouchDB instance
- Parallelism settings (default: 5 concurrent connections)
- CouchDB server performance

For production environments, measure RTO by running a test restore against a non-production database.

## Backup Commands

### Manual Backup

```bash
# Interactive backup (recommended for first-time use)
pnpm backup:interactive

# Direct backup with arguments
pnpm backup -- --database eddo_user_username --output ./backups/

# Verify backup integrity
pnpm backup:verify ./backups/eddo_user_username-2024-12-25T12-00-00-000Z.json
```

### Automated Backup

```bash
# Start continuous backup scheduler (default: 24h interval)
pnpm backup:auto --pattern "eddo_user_*"

# Custom interval
pnpm backup:auto --interval 12h --pattern "eddo_user_*"

# Single backup run (for cron jobs)
pnpm backup:auto --run-once --pattern "eddo_user_*"
```

### Retention Policy

```bash
# Preview cleanup actions
pnpm backup:retention --dry-run

# Apply retention policy
pnpm backup:retention
```

**Default retention tiers:**

- Daily backups: 30 days
- Weekly backups: 12 weeks (oldest daily per week)
- Monthly backups: 12 months (oldest weekly per month)

## Restore Procedures

### Prerequisites

Verify CouchDB is running and accessible:

```bash
curl http://localhost:5984/
# Should return: {"couchdb":"Welcome",...}
```

The backup/restore scripts use CLI flags (not environment variables) for CouchDB connection:

```bash
# Interactive mode prompts for URL
pnpm backup:interactive
pnpm restore:interactive

# Or pass URL directly
pnpm backup:interactive -- --url http://admin:password@localhost:5984
pnpm restore:interactive -- --url http://admin:password@localhost:5984
```

### Scenario 1: Single Database Restore

Use when restoring a specific user's data.

```bash
# Step 1: List available backups
ls -la ./backups/ | grep "eddo_user_username"

# Step 2: Verify backup integrity
pnpm backup:verify ./backups/eddo_user_username-2024-12-25T12-00-00-000Z.json

# Step 3: Interactive restore (safest option)
pnpm restore:interactive

# Step 4: Verify restored data
curl -u admin:password http://localhost:5984/eddo_user_username
```

### Scenario 2: Full System Restore

Use after complete data loss or migration to new server.

```bash
# Step 1: Ensure CouchDB is running and accessible
curl http://localhost:5984/

# Step 2: List all backup files
ls -la ./backups/

# Step 3: Restore each database
for backup in ./backups/eddo_*.json; do
  dbname=$(basename "$backup" | sed 's/-[0-9T-]*\.json$//')
  echo "Restoring $dbname..."
  pnpm restore -- --input "$backup" --database "$dbname" --force-overwrite
done

# Step 4: Verify all databases
curl -u admin:password http://localhost:5984/_all_dbs
```

### Scenario 3: Point-in-Time Recovery

Use when recovering to a specific backup timestamp.

```bash
# Step 1: Find backup for desired point in time
ls -la ./backups/ | grep "2024-12-24"

# Step 2: Restore from specific backup
pnpm restore:interactive
# Select the backup file for the desired timestamp

# Step 3: Note that newer data will be lost
# PouchDB clients will sync their local data back to the restored database
```

## CLI Options

The interactive backup/restore scripts accept:

| Option                 | Short | Description                                                |
| ---------------------- | ----- | ---------------------------------------------------------- |
| `--url <url>`          | `-u`  | CouchDB URL (e.g., `http://admin:password@localhost:5984`) |
| `--database <name>`    | `-d`  | Database name                                              |
| `--backup-dir <path>`  | `-b`  | Backup directory (default: `./backups`)                    |
| `--backup-file <path>` | `-f`  | Backup file path (restore only)                            |
| `--parallelism <n>`    | `-p`  | Parallel connections (default: 5)                          |
| `--timeout <ms>`       | `-t`  | Request timeout (default: 60000)                           |
| `--dry-run`            |       | Show actions without executing                             |
| `--no-interactive`     |       | Disable prompts (requires all options)                     |

## Environment Variables

The automated scheduler (`backup:auto`) still uses environment variables:

| Variable                  | Default     | Description                             |
| ------------------------- | ----------- | --------------------------------------- |
| `BACKUP_DIR`              | `./backups` | Directory for backup files              |
| `BACKUP_DATABASE_PATTERN` | `eddo_*`    | Glob pattern for databases              |
| `COUCHDB_URL`             | Required    | CouchDB connection URL (scheduler only) |

## Backup File Format

Backups use `@cloudant/couchbackup` format:

```
Line 1: {"name":"@cloudant/couchbackup","version":"2.x","mode":"full","attachments":false}
Line 2+: [{doc1}, {doc2}, ...] (batched JSON arrays)
```

Each backup creates:

- `{database}-{timestamp}.json` - Backup data
- `{database}-{timestamp}.json.log` - Operation log

## Troubleshooting

### Backup Fails with Timeout

```bash
# Increase timeout (default: 60000ms)
pnpm backup:interactive
# Select higher timeout value when prompted

# Or via CLI
pnpm backup -- --database mydb --timeout 120000
```

### Restore Fails with "Database Not Empty"

```bash
# Use force-overwrite flag (recreates database)
pnpm restore -- --input backup.json --database mydb --force-overwrite
```

### Backup Verification Fails

```bash
# Check file integrity
pnpm backup:verify ./backups/problematic-backup.json

# Common issues:
# - Incomplete backup (process interrupted)
# - Disk corruption
# - JSON parse errors

# Solution: Use the previous valid backup
```

### Large Database Backup Performance

```bash
# Increase parallelism for faster backups
pnpm backup -- --database large_db --parallelism 10

# Monitor backup progress in log file
tail -f ./backups/large_db-*.json.log
```

## Offline-First Considerations

Eddo uses PouchDB for offline-first storage. After a restore:

1. **Browser clients** retain local PouchDB data
2. **Sync resumes** automatically when clients reconnect
3. **Conflicts** are resolved by CouchDB's deterministic algorithm
4. **Newer local changes** will sync back to the restored database

This means:

- Users won't lose local changes made while offline
- Restored database receives updates from all connected clients
- No manual intervention required for conflict resolution

## Recommended Backup Schedule

### Production Environment

```bash
# Run as systemd service or cron job
pnpm backup:auto --interval 24h --pattern "eddo_user_*"
```

Add to crontab for retention cleanup:

```cron
# Run retention policy weekly at 3 AM Sunday
0 3 * * 0 cd /path/to/eddoapp && pnpm backup:retention
```

### Development Environment

Manual backups before major changes:

```bash
pnpm backup:interactive
```

## Related Documentation

- [CouchDB Local Setup](./06_couchdb_local.md)
- [Architecture Overview](./03_architecture.md)
- [Deployment Guide](./05_deployment.md)
