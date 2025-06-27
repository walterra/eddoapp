#!/usr/bin/env tsx

/**
 * Basic restore script using @cloudant/couchbackup
 * Restores CouchDB database from a JSON backup file
 */

import fs from 'fs';
import path from 'path';
import { restore as couchrestore } from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/shared/config';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

// Additional restore-specific configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface RestoreOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

function getLatestBackupFile(database: string): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((file) => file.startsWith(`${database}-`) && file.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No backup files found for database: ${database}`);
  }

  return path.join(BACKUP_DIR, files[0]);
}

async function restore(backupFile?: string): Promise<void> {
  try {
    const restoreFile = backupFile || getLatestBackupFile(couchConfig.dbName);
    
    if (!fs.existsSync(restoreFile)) {
      throw new Error(`Backup file does not exist: ${restoreFile}`);
    }

    console.log(`Starting restore of ${couchConfig.dbName} database...`);
    console.log(`Source: ${restoreFile}`);
    console.log(`Destination: ${couchConfig.fullUrl}`);

    const readStream = fs.createReadStream(restoreFile);
    
    const options: RestoreOptions = {
      parallelism: 5,
      requestTimeout: 60000,
      logfile: `${restoreFile}.restore.log`
    };

    await new Promise<void>((resolve, reject) => {
      couchrestore(
        couchConfig.fullUrl,
        readStream,
        options,
        (err: Error | null, data?: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    console.log(`Restore completed successfully from: ${restoreFile}`);
    
  } catch (error) {
    console.error('Restore failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.length > 0 ? args[0] : undefined;

// Run restore if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  restore(backupFile).catch(console.error);
}

export { restore };