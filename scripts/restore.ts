#!/usr/bin/env tsx

/**
 * Basic restore script using @cloudant/couchbackup
 * Restores CouchDB database from a JSON backup file
 */

import fs from 'fs';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/core/config';
import { 
  getLatestBackupFile,
  checkDatabaseExists,
  recreateDatabase,
  formatFileSize,
  createRestoreOptions,
  DEFAULT_CONFIG,
  type RestoreOptions
} from './backup-utils.js';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

// Additional restore-specific configuration
const BACKUP_DIR = process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir;




async function restore(backupFile?: string, database?: string, force: boolean = false): Promise<void> {
  try {
    const dbName = database || couchConfig.dbName;
    const restoreFile = backupFile || getLatestBackupFile(dbName, BACKUP_DIR);
    
    if (!fs.existsSync(restoreFile)) {
      throw new Error(`Backup file does not exist: ${restoreFile}`);
    }

    // Check if database exists and has documents
    const { exists, docCount } = await checkDatabaseExists(dbName, env.COUCHDB_URL);
    
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
    await recreateDatabase(dbName, env.COUCHDB_URL);

    const readStream = fs.createReadStream(restoreFile);
    
    const options = createRestoreOptions({
      logfile: `${restoreFile}.restore.log`
    });

    // Log file stats for debugging
    const fileStats = fs.statSync(restoreFile);
    console.log(`Backup file size: ${formatFileSize(fileStats.size)}`);

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