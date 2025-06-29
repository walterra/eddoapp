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

async function checkDatabaseExists(dbName: string): Promise<{ exists: boolean; docCount: number }> {
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

    const response = await fetch(`${baseUrl}/${dbName}`, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      return { exists: false, docCount: 0 };
    }

    if (!response.ok) {
      throw new Error(`Failed to check database: ${response.statusText}`);
    }

    const dbInfo = await response.json();
    return { exists: true, docCount: dbInfo.doc_count || 0 };
    
  } catch (error) {
    throw new Error(`Failed to check database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function recreateDatabase(dbName: string): Promise<void> {
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

    console.log(`Recreating database: ${dbName}`);

    // Delete existing database
    const deleteResponse = await fetch(`${baseUrl}/${dbName}`, {
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
    const createResponse = await fetch(`${baseUrl}/${dbName}`, {
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

async function restore(backupFile?: string, database?: string, force: boolean = false): Promise<void> {
  try {
    const dbName = database || couchConfig.dbName;
    const restoreFile = backupFile || getLatestBackupFile(dbName);
    
    if (!fs.existsSync(restoreFile)) {
      throw new Error(`Backup file does not exist: ${restoreFile}`);
    }

    // Check if database exists and has documents
    const { exists, docCount } = await checkDatabaseExists(dbName);
    
    if (exists && docCount > 0 && !force) {
      console.error(`Error: Database '${dbName}' already exists and contains ${docCount} documents.`);
      console.error('This restore operation would overwrite existing data.');
      console.error('');
      console.error('To proceed anyway, use the --force parameter:');
      console.error(`  pnpm tsx scripts/restore.ts ${backupFile || ''} ${database ? `--database ${database}` : ''} --force`.trim());
      process.exit(1);
    }

    // Build the full database URL
    const dbUrl = couchConfig.url + '/' + dbName;

    console.log(`Starting restore of ${dbName} database...`);
    console.log(`Source: ${restoreFile}`);
    console.log(`Destination: ${dbUrl}`);
    
    if (exists && docCount > 0) {
      console.log(`Warning: Overwriting existing database with ${docCount} documents (--force was used)`);
    }

    // Recreate the database to ensure it's empty
    await recreateDatabase(dbName);

    const readStream = fs.createReadStream(restoreFile);
    
    const options: RestoreOptions = {
      parallelism: 5,
      requestTimeout: 60000,
      logfile: `${restoreFile}.restore.log`
    };

    // Log file stats for debugging
    const fileStats = fs.statSync(restoreFile);
    console.log(`Backup file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

    await new Promise<void>((resolve, reject) => {
      couchbackup.restore(
        readStream,
        dbUrl,
        options,
        (err: Error | null, data?: unknown) => {
          if (err) {
            reject(err);
          } else {
            console.log('Restore process completed');
            resolve();
          }
        }
      );
    });

    console.log(`Restore completed successfully from: ${restoreFile}`);
    
    // Check if log file exists and show any errors
    if (fs.existsSync(`${restoreFile}.restore.log`)) {
      console.log(`Log file created: ${restoreFile}.restore.log`);
    }
    
    // Verify the restored database
    const { exists: verifyExists, docCount: verifyDocCount } = await checkDatabaseExists(dbName);
    if (verifyExists) {
      console.log(`Verified: Database '${dbName}' now contains ${verifyDocCount} documents`);
    }
    
  } catch (error) {
    console.error('Restore failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let backupFile: string | undefined;
  let database: string | undefined;
  let force: boolean = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--database' || arg === '-d') {
      database = args[i + 1];
      i++; // Skip next argument as it's the value
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

// Run restore if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  // If no arguments provided, delegate to interactive restore
  if (args.length === 0) {
    console.log('No arguments provided, starting interactive restore...\n');
    import('./restore-interactive.js').then(({ performRestore, getRestoreConfig }) => {
      return getRestoreConfig({}).then(config => performRestore(config, true));
    }).catch(console.error);
  } else {
    const { backupFile, database, force } = parseArgs();
    restore(backupFile, database, force).catch(console.error);
  }
}

export { restore };