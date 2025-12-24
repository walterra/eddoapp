#!/usr/bin/env tsx

/**
 * Automated Backup Scheduler
 * Runs backups on a configurable schedule with verification and retention policy
 */

import { getAvailableDatabases, validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import { Command } from 'commander';
import { dotenvLoad } from 'dotenv-mono';
import { applyRetentionPolicy, type RetentionConfig } from './backup-retention.js';
import { DEFAULT_CONFIG, ensureBackupDir, getAllBackupFiles } from './backup-utils.js';
import { backup } from './backup.js';
import { verifyBackup } from './verify-backup.js';

// Load environment variables
dotenvLoad();

interface BackupSchedulerConfig {
  /** Backup interval in milliseconds */
  intervalMs: number;
  /** Directory to store backups */
  backupDir: string;
  /** Database name pattern to backup (glob-style, e.g., "eddo_*") */
  databasePattern: string;
  /** Run verification after each backup */
  verifyAfterBackup: boolean;
  /** Apply retention policy after backup */
  applyRetention: boolean;
  /** Retention policy configuration */
  retentionConfig: RetentionConfig;
  /** Logger interface */
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
    debug: (msg: string, meta?: unknown) => void;
  };
}

interface BackupResult {
  database: string;
  success: boolean;
  backupFile?: string;
  error?: string;
  verified?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_SCHEDULER_CONFIG: Omit<BackupSchedulerConfig, 'logger'> = {
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  backupDir: process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir,
  databasePattern: process.env.BACKUP_DATABASE_PATTERN || 'eddo_*',
  verifyAfterBackup: true,
  applyRetention: true,
  retentionConfig: {
    dailyRetentionDays: 30,
    weeklyRetentionWeeks: 12,
    monthlyRetentionMonths: 12,
    dryRun: false,
  },
};

/**
 * Console logger implementation
 */
function createConsoleLogger(): BackupSchedulerConfig['logger'] {
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
function matchesPattern(dbName: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // Order matters: escape special chars first, then convert glob wildcards
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except * and ?)
    .replace(/\*/g, '.*') // * becomes .*
    .replace(/\?/g, '.'); // ? becomes .
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(dbName);
}

/**
 * Backup Scheduler Class
 */
export class BackupScheduler {
  private config: BackupSchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastBackupTime: Date | null = null;
  private backupInProgress = false;

  constructor(
    config: Partial<BackupSchedulerConfig> & { logger?: BackupSchedulerConfig['logger'] },
  ) {
    this.config = {
      ...DEFAULT_SCHEDULER_CONFIG,
      ...config,
      logger: config.logger || createConsoleLogger(),
    };

    this.config.logger.info('Backup scheduler created', {
      intervalMs: this.config.intervalMs,
      intervalHours: (this.config.intervalMs / (1000 * 60 * 60)).toFixed(1),
      backupDir: this.config.backupDir,
      databasePattern: this.config.databasePattern,
      verifyAfterBackup: this.config.verifyAfterBackup,
      applyRetention: this.config.applyRetention,
    });
  }

  /**
   * Start the backup scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.config.logger.warn('Backup scheduler is already running');
      return;
    }

    // Ensure backup directory exists
    ensureBackupDir(this.config.backupDir);

    this.isRunning = true;

    // Run first backup immediately
    this.runBackupCycle().catch((error) => {
      this.config.logger.error('Error in initial backup cycle', { error });
    });

    // Schedule subsequent backups
    this.intervalId = setInterval(() => {
      this.runBackupCycle().catch((error) => {
        this.config.logger.error('Error in scheduled backup cycle', { error });
      });
    }, this.config.intervalMs);

    this.config.logger.info('Backup scheduler started', {
      nextBackup: new Date(Date.now() + this.config.intervalMs).toISOString(),
    });
  }

  /**
   * Stop the backup scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.config.logger.info('Backup scheduler stopped');
  }

  /**
   * Run a single backup cycle
   */
  async runBackupCycle(): Promise<BackupResult[]> {
    if (this.backupInProgress) {
      this.config.logger.warn('Backup already in progress, skipping this cycle');
      return [];
    }

    this.backupInProgress = true;
    const results: BackupResult[] = [];

    try {
      this.config.logger.info('Starting backup cycle');
      const startTime = Date.now();

      // Get databases to backup
      const databases = await this.getDatabasesToBackup();

      if (databases.length === 0) {
        this.config.logger.warn('No databases match the backup pattern', {
          pattern: this.config.databasePattern,
        });
        return results;
      }

      this.config.logger.info(`Found ${databases.length} database(s) to backup`, {
        databases,
      });

      // Backup each database
      for (const dbName of databases) {
        const result = await this.backupDatabase(dbName);
        results.push(result);
      }

      // Apply retention policy if enabled
      if (this.config.applyRetention) {
        await this.applyRetention();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      this.lastBackupTime = new Date();

      this.config.logger.info('Backup cycle completed', {
        duration: `${duration}s`,
        successful,
        failed,
        nextBackup: new Date(Date.now() + this.config.intervalMs).toISOString(),
      });

      return results;
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * Get list of databases matching the backup pattern
   */
  private async getDatabasesToBackup(): Promise<string[]> {
    try {
      const env = validateEnv(process.env);
      const allDatabases = await getAvailableDatabases(env);

      return allDatabases.filter((db) => matchesPattern(db, this.config.databasePattern));
    } catch (error) {
      this.config.logger.error('Failed to get available databases', { error });
      return [];
    }
  }

  /**
   * Backup a single database
   */
  private async backupDatabase(dbName: string): Promise<BackupResult> {
    const result: BackupResult = {
      database: dbName,
      success: false,
    };

    try {
      this.config.logger.info(`Backing up database: ${dbName}`);

      // Set environment for backup function
      const originalBackupDir = process.env.BACKUP_DIR;
      process.env.BACKUP_DIR = this.config.backupDir;

      await backup(dbName);

      // Restore original environment
      if (originalBackupDir) {
        process.env.BACKUP_DIR = originalBackupDir;
      } else {
        delete process.env.BACKUP_DIR;
      }

      // Find the created backup file
      const backupFiles = getAllBackupFiles(this.config.backupDir)
        .filter((f) => f.database === dbName)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (backupFiles.length > 0) {
        result.backupFile = backupFiles[0].path;
        result.success = true;

        // Verify backup if enabled
        if (this.config.verifyAfterBackup && result.backupFile) {
          try {
            const isValid = await verifyBackup(result.backupFile);
            result.verified = isValid;

            if (!isValid) {
              this.config.logger.warn(`Backup verification failed for ${dbName}`, {
                backupFile: result.backupFile,
              });
            }
          } catch (verifyError) {
            this.config.logger.error(`Backup verification error for ${dbName}`, {
              error: verifyError,
            });
            result.verified = false;
          }
        }

        this.config.logger.info(`Successfully backed up database: ${dbName}`, {
          backupFile: result.backupFile,
          verified: result.verified,
        });
      } else {
        result.error = 'Backup file not found after backup';
        this.config.logger.error(`Backup file not found for ${dbName}`);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.config.logger.error(`Failed to backup database: ${dbName}`, { error: result.error });
    }

    return result;
  }

  /**
   * Apply retention policy to backup files
   */
  private async applyRetention(): Promise<void> {
    try {
      this.config.logger.info('Applying retention policy');

      await applyRetentionPolicy({
        backupDir: this.config.backupDir,
        ...this.config.retentionConfig,
      });

      this.config.logger.info('Retention policy applied successfully');
    } catch (error) {
      this.config.logger.error('Failed to apply retention policy', { error });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    backupInProgress: boolean;
    lastBackupTime: Date | null;
    nextBackupTime: Date | null;
    config: Omit<BackupSchedulerConfig, 'logger'>;
  } {
    return {
      isRunning: this.isRunning,
      backupInProgress: this.backupInProgress,
      lastBackupTime: this.lastBackupTime,
      nextBackupTime: this.isRunning ? new Date(Date.now() + this.config.intervalMs) : null,
      config: {
        intervalMs: this.config.intervalMs,
        backupDir: this.config.backupDir,
        databasePattern: this.config.databasePattern,
        verifyAfterBackup: this.config.verifyAfterBackup,
        applyRetention: this.config.applyRetention,
        retentionConfig: this.config.retentionConfig,
      },
    };
  }
}

/**
 * Factory function to create a backup scheduler
 */
export function createBackupScheduler(config?: Partial<BackupSchedulerConfig>): BackupScheduler {
  return new BackupScheduler(config || {});
}

/**
 * Parse interval string to milliseconds
 * Supports: 1h, 24h, 1d, 7d, etc.
 */
function parseInterval(interval: string): number {
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

// CLI setup
const program = new Command();

program
  .name('backup-scheduler')
  .description('Automated CouchDB backup scheduler with retention policy')
  .version('1.0.0')
  .option('-i, --interval <interval>', 'backup interval (e.g., 24h, 1d, 30m)', '24h')
  .option('-b, --backup-dir <path>', 'backup directory', DEFAULT_CONFIG.backupDir)
  .option('-p, --pattern <pattern>', 'database name pattern (glob)', 'eddo_*')
  .option('--no-verify', 'disable backup verification')
  .option('--no-retention', 'disable retention policy')
  .option('--retention-daily <days>', 'daily retention days', '30')
  .option('--retention-weekly <weeks>', 'weekly retention weeks', '12')
  .option('--retention-monthly <months>', 'monthly retention months', '12')
  .option('--run-once', 'run a single backup cycle and exit')
  .action(async (options) => {
    try {
      const intervalMs = parseInterval(options.interval);

      console.log(chalk.blue('\n📦 CouchDB Automated Backup Scheduler\n'));
      console.log(chalk.bold('Configuration:'));
      console.log(
        `  Interval: ${chalk.cyan(options.interval)} (${(intervalMs / (1000 * 60 * 60)).toFixed(1)} hours)`,
      );
      console.log(`  Backup Directory: ${chalk.cyan(options.backupDir)}`);
      console.log(`  Database Pattern: ${chalk.cyan(options.pattern)}`);
      console.log(
        `  Verification: ${options.verify ? chalk.green('enabled') : chalk.yellow('disabled')}`,
      );
      console.log(
        `  Retention: ${options.retention ? chalk.green('enabled') : chalk.yellow('disabled')}`,
      );

      if (options.retention) {
        console.log(`    Daily: ${chalk.cyan(options.retentionDaily)} days`);
        console.log(`    Weekly: ${chalk.cyan(options.retentionWeekly)} weeks`);
        console.log(`    Monthly: ${chalk.cyan(options.retentionMonthly)} months`);
      }

      console.log();

      const scheduler = createBackupScheduler({
        intervalMs,
        backupDir: options.backupDir,
        databasePattern: options.pattern,
        verifyAfterBackup: options.verify,
        applyRetention: options.retention,
        retentionConfig: {
          dailyRetentionDays: parseInt(options.retentionDaily, 10),
          weeklyRetentionWeeks: parseInt(options.retentionWeekly, 10),
          monthlyRetentionMonths: parseInt(options.retentionMonthly, 10),
          dryRun: false,
        },
      });

      if (options.runOnce) {
        console.log(chalk.yellow('Running single backup cycle...\n'));
        const results = await scheduler.runBackupCycle();

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        console.log(chalk.bold('\nBackup Results:'));
        results.forEach((result) => {
          if (result.success) {
            console.log(
              chalk.green(`  ✅ ${result.database}`) +
                (result.verified ? chalk.gray(' (verified)') : chalk.yellow(' (not verified)')),
            );
          } else {
            console.log(chalk.red(`  ❌ ${result.database}: ${result.error}`));
          }
        });

        console.log();
        console.log(
          `Total: ${chalk.cyan(results.length)} | Success: ${chalk.green(successful)} | Failed: ${chalk.red(failed)}`,
        );

        process.exit(failed > 0 ? 1 : 0);
      } else {
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n\nShutting down backup scheduler...'));
          scheduler.stop();
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          console.log(chalk.yellow('\n\nShutting down backup scheduler...'));
          scheduler.stop();
          process.exit(0);
        });

        scheduler.start();

        console.log(chalk.green('Backup scheduler is running. Press Ctrl+C to stop.\n'));

        // Keep the process alive
        await new Promise(() => {});
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
