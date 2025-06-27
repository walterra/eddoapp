#!/usr/bin/env node
/* eslint-env node */

/**
 * Basic restore script using @cloudant/couchbackup
 * Restores CouchDB database from a JSON backup file
 */

import fs from 'fs';
import path from 'path';
import { restore as couchrestore } from '@cloudant/couchbackup';

// Configuration
const COUCH_URL = process.env.COUCH_URL || 'http://localhost:5984';
const DATABASE = process.env.DATABASE || 'todos';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

function getLatestBackupFile(database) {
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

async function restore(backupFile = null) {
  try {
    const restoreFile = backupFile || getLatestBackupFile(DATABASE);
    
    if (!fs.existsSync(restoreFile)) {
      throw new Error(`Backup file does not exist: ${restoreFile}`);
    }

    console.log(`Starting restore of ${DATABASE} database...`);
    console.log(`Source: ${restoreFile}`);
    console.log(`Destination: ${COUCH_URL}/${DATABASE}`);

    const readStream = fs.createReadStream(restoreFile);
    
    await new Promise((resolve, reject) => {
      couchrestore(
        `${COUCH_URL}/${DATABASE}`,
        readStream,
        {
          parallelism: 5,
          requestTimeout: 60000,
          logfile: `${restoreFile}.restore.log`
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });

    console.log(`Restore completed successfully from: ${restoreFile}`);
    
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.length > 0 ? args[0] : null;

// Run restore if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  restore(backupFile);
}

export { restore };
