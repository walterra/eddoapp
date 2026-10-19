# Disaster Recovery Guide

Eddo creates logical CouchDB backups with attachment bodies, integrity metadata, and database security settings.

## Backup scope

The default scheduler scope, `eddo_*`, includes user todos, registry/preferences, chats, audit logs, attachments, and Pi sessions.
Use `--all-databases` to include every database returned by CouchDB, including `default` and system databases.
This option overrides `--pattern` and requires credentials with access to every selected database.

Backups exclude CouchDB server/admin configuration, `_local` documents, browser-local unsynced data, and other services.
They preserve current documents and available leaf revisions, not arbitrary historical revision bodies.
They are not atomic snapshots across databases. Each archive requires a stable source during its backup window.
Pause application writes and sync clients when a consistent maintenance snapshot is required.

Back up server configuration separately. Keep encrypted off-host copies of archives, metadata, and configuration.
The default recovery-point target is 24 hours. Measure restore time against disposable infrastructure.

## Create backups

Run commands from the repository root.

```bash
# One database using configured CouchDB credentials
pnpm backup --database eddo_user_walterra --backup-dir ./backups/manual

# Interactive backup with configurable connection and timeout
pnpm backup:interactive

# Full-server maintenance backup; do not delete existing backups
pnpm backup:auto --all-databases --run-once --no-retention --backup-dir ./backups/pre-migration

# Continuous application backups, every 24 hours
pnpm backup:auto

# Restrict scope intentionally (this excludes chats, attachments, audit, and registry)
pnpm backup:auto --pattern 'eddo_user_*' --interval 12h
```

`backup` and `backup:auto` load repository environment configuration, including `COUCHDB_URL`.
Interactive tools accept `--url` or prompt for connection details. URLs containing credentials appear in shell history;
prefer environment configuration or interactive input.

The scheduler defaults to `eddo_*` and 24 hours. `--all-databases` includes system databases without changing
interactive database discovery. Zero matches and discovery failures return a nonzero exit status in one-shot mode.
Verification failures count as backup failures. Retention runs only after a successful cycle.

## Archive contents

Each completed backup produces:

- `<database>-<timestamp>.json`: couchbackup full-mode document batches with inline attachment bodies.
- `<database>-<timestamp>.json.metadata.json`: format version, source database/revisions, checksum, and `_security` settings.
- `<database>-<timestamp>.json.log`: couchbackup progress log.

Keep the archive and metadata sidecar together. Files use private permissions, and new backup directories use mode `0700`.
Registry backups and metadata contain sensitive data. Do not commit or publish them.

Archive creation verifies source revisions, attachment bytes, and a stable source inventory before publication.
Source and post-restore inventories cover winning live revisions only. They do not independently verify losing
conflict leaves or tombstones. Checksums detect archive changes, not omissions from the source.
Restore accepts document-array batches and headers on physical line one. Individual-document NDJSON and
misplaced headers fail validation before target replacement.
CouchDB can digest compressed attachment bytes; metadata also records verified decoded-body digests.
The `.json` filename appears only after validation. Failed or interrupted archives remain `.partial` and are not
selected as completed backups. Inspect and remove stale partial files manually after resolving the failure.

The data format starts with:

```text
{"name":"@cloudant/couchbackup","version":"2.x","mode":"full","attachments":true}
[{"_id":"...","_rev":"..."}, ...]
```

Attachment support uses couchbackup's experimental Apache CouchDB option. These tools do not support IBM Cloudant.

## Verify backups

```bash
pnpm backup:verify ./backups/manual/<database>-<timestamp>.json

# Verify every published archive in a directory
BACKUP_DIR=./backups/manual pnpm backup:verify
```

Verification checks JSON structure, revision uniqueness, inline attachment payloads/digests, the archive checksum,
and source revisions recorded in metadata. Header-only empty database archives are valid.
A missing sidecar produces a legacy-archive warning: source completeness and security settings cannot be verified.
Attachment stubs without bodies fail verification. Such historical backups cannot recover the missing files.

Run disposable round-trip tests regularly:

```bash
pnpm test:backup
pnpm test:integration:backup
```

Integration tests start a fresh CouchDB Testcontainer and remove it afterward. They never use configured production
credentials. Coverage includes Unicode across stream boundaries, compressed attachments, conflicts, tombstones,
design documents, security settings, empty databases, legacy files, and corruption detection.

## Restore one database

1. Stop or isolate clients and writers before recovery.
2. Preserve the damaged database and its configuration separately.
3. Verify the selected archive and matching sidecar.
4. Restore into a disposable target first and inspect application behavior.
5. Confirm the intended production target before replacing it.

```bash
pnpm backup:verify ./backups/manual/<database>-<timestamp>.json

# Interactive recovery prompts for connection, archive, and target
pnpm restore:interactive

# Explicit replacement using environment credentials; DELETES the target database
pnpm restore ./backups/manual/<database>-<timestamp>.json --database eddo_recovery_check --force
```

Restore validates the archive before deleting the target, uses UTF-8-decoded input streams, checks the saved live
revision inventory, and restores `_security`. Binary input streams can corrupt Unicode at buffer boundaries;
use the shared restore tooling rather than calling couchbackup with an undecoded file stream.

Legacy non-attachment archives remain supported without enabling attachment mode. Legacy archives have no recoverable
security settings unless those settings were saved separately. Inspect restored content before relying on them.

## Restore a full server

Provision a compatible CouchDB server and restore its configuration/admin credentials separately.
Review the source database inventory, select one maintenance snapshot per database, and repeat the single-database
procedure for each database. Include registry, chats, audit, attachment, session, todo, and system databases present
in that snapshot. Do not feed `.metadata.json` files into restore as document archives.

Restore documents before enabling application traffic. Database security settings reference account names and roles;
confirm the corresponding users and administrative access exist on the recovery server.
Server-local `_local` reservations are not restored. Reconcile scheduled jobs before enabling their workers.

## Retention

```bash
pnpm backup:retention --dry-run
pnpm backup:retention
```

Default tiers retain daily backups for 30 days, one backup per week for 12 weeks, and one per month for 12 months.
Retention removes the archive, matching metadata, and logs together. It ignores incomplete `.partial` archives.
Use dedicated directories for maintenance snapshots that must not enter routine retention.

## Troubleshooting

- **Source changed:** retry during an idle period; do not rename `.partial` files to completed archives.
- **Timeout:** use `pnpm backup:interactive --timeout 120000` and adjust parallelism with `--parallelism`.
- **Attachment body missing:** create a fresh attachment-enabled backup while the source remains available.
- **Checksum/inventory mismatch:** preserve the failed files and select a separately verified archive.
- **Discovery/access failure:** verify CouchDB availability and privileges, including system database access.
- **Unexpected data after recovery:** connected PouchDB clients can sync newer local changes back into CouchDB.

CouchDB's deterministic conflict winner does not replace application-level conflict review after recovery.

## Related documentation

- [README](../README.md#backup--recovery)
- [Development Guide](../DEVELOPMENT.md)
