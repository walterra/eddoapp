/**
 * Helper functions for backup scheduler
 */
import chalk from 'chalk';

import { applyRetentionPolicy, type RetentionConfig } from './backup-retention.js';
import { getAllBackupFiles } from './backup-utils.js';
import { backup } from './backup.js';
import { verifyBackup } from './verify-backup.js';

export interface BackupResult {
  database: string;
  success: boolean;
  backupFile?: string;
  error?: string;
  verified?: boolean;
}

export interface SchedulerLogger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}

/**
 * Console logger implementation
 */
export function createConsoleLogger(): SchedulerLogger {
  return {
    info: (msg: string, meta?: unknown) => {
      console.log(chalk.blue(`[INFO] ${new Date().toISOString()} - ${msg}`), meta || '');
    },
    warn: (msg: string, meta?: unknown) => {
      console.log(chalk.yellow(`[WARN] ${new Date().toISOString()} - ${msg}`), meta || '');
    },
    error: (msg: string, meta?: unknown) => {
      console.log(chalk.red(`[ERROR] ${new Date().toISOString()} - ${msg}`), meta || '');
    },
    debug: (msg: string, meta?: unknown) => {
      if (process.env.DEBUG) {
        console.log(chalk.gray(`[DEBUG] ${new Date().toISOString()} - ${msg}`), meta || '');
      }
    },
  };
}

/**
 * Match database name against glob pattern
 */
export function matchesPattern(dbName: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(dbName);
}

/**
 * Parse interval string to milliseconds
 */
export function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(h|d|m|s)$/i);
  if (!match) {
    throw new Error(`Invalid interval format: ${interval}. Use format like "24h", "1d", "30m"`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown interval unit: ${unit}`);
  }
}

/**
 * Apply retention policy to backup files
 */
export async function applyRetention(
  backupDir: string,
  retentionConfig: RetentionConfig,
  logger: SchedulerLogger,
): Promise<void> {
  try {
    logger.info('Applying retention policy');
    await applyRetentionPolicy({ backupDir, ...retentionConfig });
    logger.info('Retention policy applied successfully');
  } catch (error) {
    logger.error('Failed to apply retention policy', { error });
  }
}

/**
 * Verify a backup file
 */
async function verifyBackupFile(
  backupFile: string,
  dbName: string,
  logger: SchedulerLogger,
): Promise<boolean> {
  try {
    const isValid = await verifyBackup(backupFile);
    if (!isValid) {
      logger.warn(`Backup verification failed for ${dbName}`, { backupFile });
    }
    return isValid;
  } catch (verifyError) {
    logger.error(`Backup verification error for ${dbName}`, { error: verifyError });
    return false;
  }
}

/**
 * Backup a single database
 */
export async function backupDatabase(
  dbName: string,
  backupDir: string,
  verifyAfterBackup: boolean,
  logger: SchedulerLogger,
): Promise<BackupResult> {
  const result: BackupResult = { database: dbName, success: false };

  try {
    logger.info(`Backing up database: ${dbName}`);

    const originalBackupDir = process.env.BACKUP_DIR;
    process.env.BACKUP_DIR = backupDir;

    await backup(dbName);

    if (originalBackupDir) {
      process.env.BACKUP_DIR = originalBackupDir;
    } else {
      delete process.env.BACKUP_DIR;
    }

    const backupFiles = getAllBackupFiles(backupDir)
      .filter((f) => f.database === dbName)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (backupFiles.length > 0) {
      result.backupFile = backupFiles[0].path;
      result.success = true;

      if (verifyAfterBackup && result.backupFile) {
        result.verified = await verifyBackupFile(result.backupFile, dbName, logger);
      }

      logger.info(`Successfully backed up database: ${dbName}`, {
        backupFile: result.backupFile,
        verified: result.verified,
      });
    } else {
      result.error = 'Backup file not found after backup';
      logger.error(`Backup file not found for ${dbName}`);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to backup database: ${dbName}`, { error: result.error });
  }

  return result;
}
