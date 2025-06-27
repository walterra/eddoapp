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
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5984';
const COUCHDB_DB_NAME = process.env.COUCHDB_DB_NAME || 'todos-dev';
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
    const restoreFile = backupFile || getLatestBackupFile(COUCHDB_DB_NAME);
    
    if (!fs.existsSync(restoreFile)) {
      throw new Error(`Backup file does not exist: ${restoreFile}`);
    }

    console.log(`Starting restore of ${COUCHDB_DB_NAME} database...`);
    console.log(`Source: ${restoreFile}`);
    console.log(`Destination: ${COUCHDB_URL}/${COUCHDB_DB_NAME}`);

    const readStream = fs.createReadStream(restoreFile);
    
    await new Promise((resolve, reject) => {
      couchrestore(
        `${COUCHDB_URL}/${COUCHDB_DB_NAME}`,
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
