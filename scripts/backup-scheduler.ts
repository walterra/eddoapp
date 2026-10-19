#!/usr/bin/env tsx

/**
 * Automated Backup Scheduler
 * Runs backups on a configurable schedule with verification and retention policy
 */

import { validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import { Command } from 'commander';
import { dotenvLoad } from 'dotenv-mono';
import { type RetentionConfig } from './backup-retention.js';
import {
  applyRetention,
  backupDatabase,
  type BackupResult,
  createConsoleLogger,
  displayResults,
  logBackupCycleCompleted,
  matchesPattern,
  parseInterval,
  type SchedulerLogger,
} from './backup-scheduler-helpers.js';
import { DEFAULT_CONFIG, ensureBackupDir } from './backup-utils.js';
import { discoverBackupDatabases } from './backup_transport.js';

// Load environment variables
dotenvLoad();

interface BackupSchedulerConfig {
  intervalMs: number;
  backupDir: string;
  databasePattern: string;
  allDatabases: boolean;
  verifyAfterBackup: boolean;
  applyRetention: boolean;
  retentionConfig: RetentionConfig;
  logger: SchedulerLogger;
}

const DEFAULT_SCHEDULER_CONFIG: Omit<BackupSchedulerConfig, 'logger'> = {
  intervalMs: 24 * 60 * 60 * 1000,
  backupDir: process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir,
  databasePattern: process.env.BACKUP_DATABASE_PATTERN || 'eddo_*',
  allDatabases: false,
  verifyAfterBackup: true,
  applyRetention: true,
  retentionConfig: {
    dailyRetentionDays: 30,
    weeklyRetentionWeeks: 12,
    monthlyRetentionMonths: 12,
    dryRun: false,
  },
};

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
    });
  }

  start(): void {
    if (this.isRunning) {
      this.config.logger.warn('Backup scheduler is already running');
      return;
    }

    ensureBackupDir(this.config.backupDir);
    this.isRunning = true;

    this.runBackupCycle().catch((error) => {
      this.config.logger.error('Error in initial backup cycle', { error });
    });

    this.intervalId = setInterval(() => {
      this.runBackupCycle().catch((error) => {
        this.config.logger.error('Error in scheduled backup cycle', { error });
      });
    }, this.config.intervalMs);

    this.config.logger.info('Backup scheduler started', {
      nextBackup: new Date(Date.now() + this.config.intervalMs).toISOString(),
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.config.logger.info('Backup scheduler stopped');
  }

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

      const databases = await this.getDatabasesToBackup();

      if (databases.length === 0) {
        this.config.logger.warn('No databases match the backup pattern', {
          pattern: this.config.databasePattern,
        });
        return results;
      }

      this.config.logger.info(`Found ${databases.length} database(s) to backup`, { databases });

      for (const dbName of databases) {
        const result = await backupDatabase(
          dbName,
          this.config.backupDir,
          this.config.verifyAfterBackup,
          this.config.logger,
        );
        results.push(result);
      }

      if (this.config.applyRetention && results.every((result) => result.success)) {
        await applyRetention(
          this.config.backupDir,
          this.config.retentionConfig,
          this.config.logger,
        );
      }

      this.lastBackupTime = new Date();
      logBackupCycleCompleted(results, startTime, this.config.intervalMs, this.config.logger);

      return results;
    } catch {
      this.config.logger.error('Backup cycle failed during database discovery or retention');
      results.push({ database: '<backup-cycle>', success: false, error: 'Backup cycle failed' });
      return results;
    } finally {
      this.backupInProgress = false;
    }
  }

  private async getDatabasesToBackup(): Promise<string[]> {
    const env = validateEnv(process.env);
    const databases = await discoverBackupDatabases(env.COUCHDB_URL, this.config.allDatabases);
    return this.config.allDatabases
      ? databases
      : databases.filter((db) => matchesPattern(db, this.config.databasePattern));
  }

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
        allDatabases: this.config.allDatabases,
        verifyAfterBackup: this.config.verifyAfterBackup,
        applyRetention: this.config.applyRetention,
        retentionConfig: this.config.retentionConfig,
      },
    };
  }
}

export function createBackupScheduler(config?: Partial<BackupSchedulerConfig>): BackupScheduler {
  return new BackupScheduler(config || {});
}

interface CliOptions {
  interval: string;
  backupDir: string;
  pattern: string;
  verify: boolean;
  retention: boolean;
  retentionDaily: string;
  retentionWeekly: string;
  retentionMonthly: string;
  runOnce?: boolean;
  allDatabases?: boolean;
}

/** Display CLI configuration */
function displayConfig(options: CliOptions, intervalMs: number): void {
  console.log(chalk.blue('\n📦 CouchDB Automated Backup Scheduler\n'));
  console.log(chalk.bold('Configuration:'));
  console.log(
    `  Interval: ${chalk.cyan(options.interval)} (${(intervalMs / (1000 * 60 * 60)).toFixed(1)} hours)`,
  );
  console.log(`  Backup Directory: ${chalk.cyan(options.backupDir)}`);
  console.log(
    `  Database Scope: ${options.allDatabases ? 'ALL (including system databases)' : chalk.cyan(options.pattern)}`,
  );
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
}

/** Create scheduler from CLI options */
function createSchedulerFromOptions(options: CliOptions, intervalMs: number): BackupScheduler {
  return createBackupScheduler({
    intervalMs,
    backupDir: options.backupDir,
    databasePattern: options.pattern,
    allDatabases: options.allDatabases ?? false,
    verifyAfterBackup: options.verify,
    applyRetention: options.retention,
    retentionConfig: {
      dailyRetentionDays: parseInt(options.retentionDaily, 10),
      weeklyRetentionWeeks: parseInt(options.retentionWeekly, 10),
      monthlyRetentionMonths: parseInt(options.retentionMonthly, 10),
      dryRun: false,
    },
  });
}

/** Setup shutdown handlers */
function setupShutdownHandlers(scheduler: BackupScheduler): void {
  const shutdown = () => {
    console.log(chalk.yellow('\n\nShutting down backup scheduler...'));
    scheduler.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Run CLI action */
async function runCli(options: CliOptions): Promise<void> {
  const intervalMs = parseInterval(options.interval);
  displayConfig(options, intervalMs);
  const scheduler = createSchedulerFromOptions(options, intervalMs);

  if (options.runOnce) {
    console.log(chalk.yellow('Running single backup cycle...\n'));
    const results = await scheduler.runBackupCycle();
    displayResults(results);
    process.exit(results.length === 0 || results.some((r) => !r.success) ? 1 : 0);
  } else {
    setupShutdownHandlers(scheduler);
    scheduler.start();
    console.log(chalk.green('Backup scheduler is running. Press Ctrl+C to stop.\n'));
    await new Promise(() => {});
  }
}

const program = new Command();
program
  .name('backup-scheduler')
  .description('Automated CouchDB backup scheduler with retention policy')
  .version('1.0.0')
  .option('-i, --interval <interval>', 'backup interval (e.g., 24h, 1d, 30m)', '24h')
  .option(
    '-b, --backup-dir <path>',
    'backup directory',
    process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir,
  )
  .option(
    '-p, --pattern <pattern>',
    'database name pattern (glob)',
    process.env.BACKUP_DATABASE_PATTERN || 'eddo_*',
  )
  .option(
    '--all-databases',
    'include every database, including system databases; overrides --pattern',
  )
  .option(
    '--no-verify',
    'disable additional post-backup verification; archive creation still validates integrity',
  )
  .option('--no-retention', 'disable retention policy')
  .option('--retention-daily <days>', 'daily retention days', '30')
  .option('--retention-weekly <weeks>', 'weekly retention weeks', '12')
  .option('--retention-monthly <months>', 'monthly retention months', '12')
  .option('--run-once', 'run a single backup cycle and exit')
  .action(async (options) => {
    try {
      await runCli(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
