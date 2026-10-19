#!/usr/bin/env tsx
/** Creates a verified CouchDB archive using environment configuration. */
import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import { dotenvLoad } from 'dotenv-mono';
import { DEFAULT_CONFIG } from './backup-utils.js';
import { createBackupArchive } from './backup_archive.js';

dotenvLoad();

/** Backs up one database and returns its published archive path. */
export async function backup(database?: string, directory?: string): Promise<string> {
  const env = validateEnv(process.env);
  const config = getCouchDbConfig(env);
  const name = database || config.dbName;
  console.log(`Starting backup of ${name} database...`);
  const file = await createBackupArchive({
    databaseUrl: `${config.url}/${encodeURIComponent(name)}`,
    directory: directory || process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir,
  });
  console.log(`Backup completed and verified: ${file}`);
  return file;
}

interface BackupArguments {
  showHelp: boolean;
  database?: string;
  backupDir?: string;
}

/** Parses the basic backup command options. */
function parseArgs(): BackupArguments {
  const args = process.argv.slice(2);
  const databaseIndex = args.findIndex((arg) => arg === '--database' || arg === '-d');
  const directoryIndex = args.findIndex((arg) => arg === '--backup-dir' || arg === '-b');
  return {
    showHelp: args.includes('--help') || args.includes('-h'),
    database: databaseIndex >= 0 ? args[databaseIndex + 1] : undefined,
    backupDir: directoryIndex >= 0 ? args[directoryIndex + 1] : undefined,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  if (args.showHelp) {
    console.log('Usage: pnpm backup [--database <name>] [--backup-dir <path>]');
    console.log(
      'Includes attachments and security metadata. Use backup:auto --all-databases --run-once for a full server backup.',
    );
  } else {
    backup(args.database, args.backupDir).catch(() => {
      console.error(
        'Backup failed; no verified archive was published. Check database access and concurrent writes.',
      );
      process.exitCode = 1;
    });
  }
}
