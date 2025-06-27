#!/usr/bin/env tsx

/**
 * Basic restore script using @cloudant/couchbackup
 * Restores CouchDB database from a JSON backup file
 */

import fs from 'fs';
import path from 'path';
import couchbackup from '@cloudant/couchbackup';
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

async function recreateDatabase(): Promise<void> {
  try {
    const url = new URL(env.COUCHDB_URL);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    console.log(`Recreating database: ${couchConfig.dbName}`);

    // Delete existing database
    const deleteResponse = await fetch(`${baseUrl}/${couchConfig.dbName}`, {
      method: 'DELETE',
      headers,
    });

    if (deleteResponse.status === 404) {
      console.log('Database does not exist, creating new one...');
    } else if (!deleteResponse.ok) {
      throw new Error(`Failed to delete database: ${deleteResponse.statusText}`);
    } else {
      console.log('Existing database deleted');
    }

    // Create new database
    const createResponse = await fetch(`${baseUrl}/${couchConfig.dbName}`, {
      method: 'PUT',
      headers,
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create database: ${createResponse.statusText}`);
    }

    console.log('New empty database created');
    
  } catch (error) {
    throw new Error(`Failed to recreate database: ${error instanceof Error ? error.message : String(error)}`);
  }
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

    // Recreate the database to ensure it's empty
    await recreateDatabase();

    const readStream = fs.createReadStream(restoreFile);
    
    const options: RestoreOptions = {
      parallelism: 5,
      requestTimeout: 60000,
      logfile: `${restoreFile}.restore.log`
    };

    await new Promise<void>((resolve, reject) => {
      couchbackup.restore(
        readStream,
        couchConfig.fullUrl,
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