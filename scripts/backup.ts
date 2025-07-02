#!/usr/bin/env tsx

/**
 * Basic backup script using @cloudant/couchbackup
 * Backs up CouchDB database to a JSON file
 */

import fs from 'fs';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/shared/config';
import { 
  ensureBackupDir, 
  generateBackupFilename, 
  formatFileSize,
  createBackupOptions,
  DEFAULT_CONFIG
} from './backup-utils.js';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

// Additional backup-specific configuration
const BACKUP_DIR = process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir;

async function backup(): Promise<void> {
  try {
    // Ensure backup directory exists
    ensureBackupDir(BACKUP_DIR);

    // Generate backup filename with timestamp
    const backupFile = generateBackupFilename(couchConfig.dbName, BACKUP_DIR);

    console.log(`Starting backup of ${couchConfig.dbName} database...`);
    console.log(`Source: ${couchConfig.fullUrl}`);
    console.log(`Destination: ${backupFile}`);

    const writeStream = fs.createWriteStream(backupFile);

    const options = createBackupOptions({
      logfile: `${backupFile}.log`
    });

    await new Promise<void>((resolve, reject) => {
      couchbackup.backup(
        couchConfig.fullUrl,
        writeStream,
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

    console.log(`Backup completed successfully: ${backupFile}`);

    // Display backup file size
    const stats = fs.statSync(backupFile);
    console.log(`Backup size: ${formatFileSize(stats.size)}`);

  } catch (error) {
    console.error('Backup failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backup().catch(console.error);
}

export { backup };
