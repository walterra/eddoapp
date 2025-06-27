#!/usr/bin/env node
/* eslint-env node */

/**
 * Basic backup script using @cloudant/couchbackup
 * Backs up CouchDB database to a JSON file
 */

import fs from 'fs';
import path from 'path';
import couchbackup from '@cloudant/couchbackup';

// Configuration
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5984';
const COUCHDB_DB_NAME = process.env.COUCHDB_DB_NAME || 'todos-dev';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

async function backup() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${COUCHDB_DB_NAME}-${timestamp}.json`);

    console.log(`Starting backup of ${COUCHDB_DB_NAME} database...`);
    console.log(`Source: ${COUCHDB_URL}/${COUCHDB_DB_NAME}`);
    console.log(`Destination: ${backupFile}`);

    const writeStream = fs.createWriteStream(backupFile);
    
    await new Promise((resolve, reject) => {
      couchbackup.backup(
        `${COUCHDB_URL}/${COUCHDB_DB_NAME}`,
        writeStream,
        {
          parallelism: 5,
          requestTimeout: 60000,
          logfile: `${backupFile}.log`
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

    console.log(`Backup completed successfully: ${backupFile}`);
    
    // Display backup file size
    const stats = fs.statSync(backupFile);
    console.log(`Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backup();
}

export { backup };
