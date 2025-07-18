#!/usr/bin/env tsx

/**
 * Basic backup script using @cloudant/couchbackup
 * Backs up CouchDB database to a JSON file
 */

import fs from 'fs';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/core-server/config';
import { 
  ensureBackupDir, 
  generateBackupFilename, 
  formatFileSize,
  createBackupOptions,
  DEFAULT_CONFIG
} from './backup-utils.js';

// Additional backup-specific configuration
const BACKUP_DIR = process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir;

async function backup(): Promise<void> {
  try {
    // Environment configuration using shared validation
    const env = validateEnv(process.env);
    const couchConfig = getCouchDbConfig(env);

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

// Add basic CLI argument parsing
function parseArgs(): { showHelp: boolean; database?: string; backupDir?: string } {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    return { showHelp: true };
  }
  
  const databaseIndex = args.findIndex(arg => arg === '--database' || arg === '-d');
  const backupDirIndex = args.findIndex(arg => arg === '--backup-dir' || arg === '-b');
  
  return {
    showHelp: false,
    database: databaseIndex >= 0 ? args[databaseIndex + 1] : undefined,
    backupDir: backupDirIndex >= 0 ? args[backupDirIndex + 1] : undefined,
  };
}

function showHelp() {
  console.log(`
Usage: backup [options]

Basic CouchDB backup tool

Options:
  -d, --database <name>     database name to backup
  -b, --backup-dir <path>   backup directory (default: "./backups")
  -h, --help                display help for command

Examples:
  backup                    # backup default database
  backup --database mydb    # backup specific database
  backup --backup-dir /tmp  # backup to custom directory

Note: For more advanced features, use 'pnpm backup:interactive'
`);
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  
  if (args.showHelp) {
    showHelp();
    process.exit(0);
  }
  
  // Override backup directory if specified
  if (args.backupDir) {
    process.env.BACKUP_DIR = args.backupDir;
  }
  
  backup().catch(console.error);
}

export { backup };
