#!/usr/bin/env tsx

/**
 * Basic restore script using @cloudant/couchbackup
 * Restores CouchDB database from a JSON backup file
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import { recreateDatabase } from './backup-utils.js';
import {
  checkDatabaseForRestore,
  checkRestoreLogFile,
  delegateToInteractiveRestore,
  getRestoreContext,
  logRestoreStart,
  performCouchbackupRestore,
  verifyRestoredDatabase,
} from './restore-helpers.js';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

async function restore(
  backupFile?: string,
  database?: string,
  force: boolean = false,
): Promise<void> {
  try {
    const ctx = getRestoreContext(backupFile, database);

    const checkResult = await checkDatabaseForRestore({
      dbName: ctx.dbName,
      couchUrl: ctx.couchUrl,
      force,
      backupFile,
      database,
    });

    if (!checkResult.shouldProceed) {
      process.exit(1);
    }

    logRestoreStart(ctx);
    await recreateDatabase(ctx.dbName, ctx.couchUrl);
    await performCouchbackupRestore(ctx.restoreFile, ctx.dbUrl);

    console.log(`Restore completed successfully from: ${ctx.restoreFile}`);

    checkRestoreLogFile(ctx.restoreFile);
    await verifyRestoredDatabase(ctx.dbName);
  } catch (error) {
    console.error('Restore failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseArgs(): { backupFile?: string; database?: string; force: boolean } {
  const args = process.argv.slice(2);
  let backupFile: string | undefined;
  let database: string | undefined;
  let force: boolean = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--database' || arg === '-d') {
      database = args[i + 1];
      i++;
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: restore.ts [backup-file] [options]

Arguments:
  backup-file       Path to backup file (optional, uses latest if not specified)

Options:
  -d, --database    Target database name (default: ${couchConfig.dbName})
  -f, --force       Force restore even if database exists and has documents
  -h, --help        Show this help message

Examples:
  pnpm tsx scripts/restore.ts
  pnpm tsx scripts/restore.ts backups/todos-dev-2025-06-27T14-12-05-618Z.json
  pnpm tsx scripts/restore.ts --database my-other-db
  pnpm tsx scripts/restore.ts backups/backup.json --database my-other-db
  pnpm tsx scripts/restore.ts --force
  pnpm tsx scripts/restore.ts backups/backup.json --database my-other-db --force
      `);
      process.exit(0);
    } else if (!backupFile && !arg.startsWith('-')) {
      backupFile = arg;
    }
  }

  return { backupFile, database, force };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    delegateToInteractiveRestore().catch(console.error);
  } else {
    const { backupFile, database, force } = parseArgs();
    restore(backupFile, database, force).catch(console.error);
  }
}

export { restore };
