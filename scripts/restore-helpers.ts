/**
 * Helper functions for restore operations
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import fs from 'fs';
import {
  checkDatabaseExists,
  createRestoreOptions,
  DEFAULT_CONFIG,
  formatFileSize,
  getLatestBackupFile,
} from './backup-utils.js';

/** Configuration for couchbackup restore */
export interface RestoreContext {
  dbName: string;
  restoreFile: string;
  dbUrl: string;
  couchUrl: string;
}

/** Result of database existence check */
export interface DatabaseCheckResult {
  exists: boolean;
  docCount: number;
  shouldProceed: boolean;
}

/** Options for database restore check */
export interface RestoreCheckOptions {
  dbName: string;
  couchUrl: string;
  force: boolean;
  backupFile?: string;
  database?: string;
}

/**
 * Validate restore parameters and return context
 */
export function getRestoreContext(backupFile?: string, database?: string): RestoreContext {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);

  const dbName = database || couchConfig.dbName;
  const backupDir = process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir;
  const restoreFile = backupFile || getLatestBackupFile(dbName, backupDir);

  if (!fs.existsSync(restoreFile)) {
    throw new Error(`Backup file does not exist: ${restoreFile}`);
  }

  return {
    dbName,
    restoreFile,
    dbUrl: couchConfig.url + '/' + dbName,
    couchUrl: env.COUCHDB_URL,
  };
}

/**
 * Print error message when database exists and force is not used
 */
function printExistingDatabaseError(opts: RestoreCheckOptions, docCount: number): void {
  console.error(
    `Error: Database '${opts.dbName}' already exists and contains ${docCount} documents.`,
  );
  console.error('This restore operation would overwrite existing data.');
  console.error('');
  console.error('To proceed anyway, use the --force parameter:');
  console.error(
    `  pnpm tsx scripts/restore.ts ${opts.backupFile || ''} ${opts.database ? `--database ${opts.database}` : ''} --force`.trim(),
  );
}

/**
 * Check database status and determine if restore should proceed
 */
export async function checkDatabaseForRestore(
  opts: RestoreCheckOptions,
): Promise<DatabaseCheckResult> {
  const { exists, docCount } = await checkDatabaseExists(opts.dbName, opts.couchUrl);

  if (exists && docCount > 0 && !opts.force) {
    printExistingDatabaseError(opts, docCount);
    return { exists, docCount, shouldProceed: false };
  }

  if (exists && docCount > 0) {
    console.log(
      `Warning: Overwriting existing database with ${docCount} documents (--force was used)`,
    );
  }

  return { exists, docCount, shouldProceed: true };
}

/**
 * Log restore operation details
 */
export function logRestoreStart(ctx: RestoreContext): void {
  console.log(`Starting restore of ${ctx.dbName} database...`);
  console.log(`Source: ${ctx.restoreFile}`);
  console.log(`Destination: ${ctx.dbUrl}`);

  const fileStats = fs.statSync(ctx.restoreFile);
  console.log(`Backup file size: ${formatFileSize(fileStats.size)}`);
}

/**
 * Perform the actual couchbackup restore operation
 */
export async function performCouchbackupRestore(restoreFile: string, dbUrl: string): Promise<void> {
  const couchbackupModule = await import('@cloudant/couchbackup');
  const readStream = fs.createReadStream(restoreFile);

  const options = createRestoreOptions({
    logfile: `${restoreFile}.restore.log`,
  });

  await new Promise<void>((resolve, reject) => {
    couchbackupModule.default.restore(
      readStream,
      dbUrl,
      options,
      (err: Error | null, _data?: unknown) => {
        if (err) {
          reject(err);
        } else {
          console.log('Restore process completed');
          resolve();
        }
      },
    );
  });
}

/**
 * Verify restored database and log results
 */
export async function verifyRestoredDatabase(dbName: string, couchUrl?: string): Promise<void> {
  const { exists, docCount } = await checkDatabaseExists(dbName, couchUrl);
  if (exists) {
    console.log(`Verified: Database '${dbName}' now contains ${docCount} documents`);
  }
}

/**
 * Check and log restore log file existence
 */
export function checkRestoreLogFile(restoreFile: string): void {
  if (fs.existsSync(`${restoreFile}.restore.log`)) {
    console.log(`Log file created: ${restoreFile}.restore.log`);
  }
}

/**
 * Handle interactive restore delegation when no arguments provided
 */
export async function delegateToInteractiveRestore(): Promise<void> {
  console.log('No arguments provided, starting interactive restore...\n');
  const { performRestore, getRestoreConfig } = await import('./restore-interactive.js');
  const config = await getRestoreConfig({});
  await performRestore(config, true);
}
