#!/usr/bin/env tsx

/**
 * Basic backup script using @cloudant/couchbackup
 * Backs up CouchDB database to a JSON file
 */

import fs from 'fs';
import path from 'path';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/shared/config';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

// Additional backup-specific configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface BackupOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

async function backup(): Promise<void> {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${couchConfig.dbName}-${timestamp}.json`);

    console.log(`Starting backup of ${couchConfig.dbName} database...`);
    console.log(`Source: ${couchConfig.fullUrl}`);
    console.log(`Destination: ${backupFile}`);

    const writeStream = fs.createWriteStream(backupFile);

    const options: BackupOptions = {
      parallelism: 5,
      requestTimeout: 60000,
      logfile: `${backupFile}.log`
    };

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
    console.log(`Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

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
