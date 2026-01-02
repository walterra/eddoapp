#!/usr/bin/env tsx

/**
 * Interactive restore script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import couchbackup from '@cloudant/couchbackup';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import ora from 'ora';
import prompts from 'prompts';
import {
  createRestoreOptions,
  DEFAULT_CONFIG,
  formatDuration,
  formatFileSize,
  recreateDatabase,
} from './backup-utils.js';
import {
  buildDbUrl,
  getRestoreConfig,
  parseUrl,
  type RestoreConfig,
} from './restore-interactive-prompts.js';

/**
 * Display restore configuration summary
 */
function displayRestoreSummary(config: RestoreConfig, dbUrl: string): void {
  const backupStats = fs.statSync(config.backupFile!);
  console.log('\n' + chalk.bold('Restore Configuration:'));
  console.log(`  Backup File: ${chalk.cyan(config.backupFile)}`);
  console.log(`  File Size: ${chalk.cyan(formatFileSize(backupStats.size))}`);
  console.log(`  Target Database: ${chalk.cyan(config.database)}`);
  console.log(`  Destination: ${chalk.cyan(dbUrl)}`);
  console.log(`  Parallelism: ${chalk.cyan(config.parallelism)}`);
  console.log(`  Timeout: ${chalk.cyan(config.timeout + 'ms')}`);
}

/**
 * Recreate the target database
 */
async function prepareDatabase(config: RestoreConfig): Promise<void> {
  const spinner = ora({
    text: 'Recreating target database...',
    isSilent: !process.stdout.isTTY,
  }).start();

  if (!process.stdout.isTTY) console.log('Recreating target database...');

  try {
    await recreateDatabase(config.database!, config.url);
    spinner.succeed(chalk.green(`Recreated empty target database: ${config.database}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to recreate target database'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Execute the actual restore operation
 */
async function executeRestore(config: RestoreConfig, dbUrl: string): Promise<void> {
  const spinner = ora({
    text: 'Starting restore...',
    isSilent: !process.stdout.isTTY,
  }).start();

  if (!process.stdout.isTTY) console.log('Starting restore...');

  const startTime = Date.now();
  const readStream = fs.createReadStream(config.backupFile!);

  const options = createRestoreOptions({
    parallelism: config.parallelism,
    requestTimeout: config.timeout,
    logfile: `${config.backupFile}.restore.log`,
  });

  const updateProgress = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.text = `Restoring... (${elapsed}s elapsed)`;
  }, 1000);

  await new Promise<void>((resolve, reject) => {
    couchbackup.restore(readStream, dbUrl, options, (err: Error | null) => {
      clearInterval(updateProgress);
      if (err) reject(err);
      else resolve();
    });
  });

  spinner.succeed(chalk.green('Restore completed successfully!'));

  const duration = Date.now() - startTime;
  console.log('\n' + chalk.bold('Restore Summary:'));
  console.log(`  Source: ${chalk.cyan(config.backupFile)}`);
  console.log(`  Target: ${chalk.cyan(config.database)}`);
  console.log(`  Duration: ${chalk.cyan(formatDuration(duration))}`);

  if (fs.existsSync(`${config.backupFile}.restore.log`)) {
    console.log(`  Log: ${chalk.gray(`${config.backupFile}.restore.log`)}`);
  }
}

/**
 * Request final confirmation before restore
 */
async function confirmRestore(): Promise<boolean> {
  const { finalConfirm } = await prompts({
    type: 'confirm',
    name: 'finalConfirm',
    message: chalk.red('⚠️  This will REPLACE ALL DATA in the target database. Are you sure?'),
    initial: false,
  });
  return finalConfirm;
}

/** Validate restore configuration */
function validateRestoreConfig(config: RestoreConfig): void {
  if (!config.url) throw new Error('CouchDB URL is required');
  if (!config.database) throw new Error('Database name is required');
  if (!config.backupFile || !fs.existsSync(config.backupFile)) {
    throw new Error(`Backup file does not exist: ${config.backupFile}`);
  }
}

/** Handle dry run mode */
function handleDryRun(): boolean {
  console.log(chalk.yellow('\n⚠️  Dry run mode - no restore will be performed'));
  return true;
}

/** Handle missing force overwrite */
function handleNoForceOverwrite(): boolean {
  console.log(chalk.red('\n❌ Restore cancelled - force overwrite not confirmed'));
  return true;
}

/** Get interactive confirmation if needed */
async function getInteractiveConfirmation(isInteractive: boolean): Promise<boolean> {
  if (!isInteractive) return true;
  const confirmed = await confirmRestore();
  if (!confirmed) {
    console.log(chalk.red('\nRestore cancelled.'));
    return false;
  }
  return true;
}

async function performRestore(config: RestoreConfig, isInteractive: boolean = true): Promise<void> {
  validateRestoreConfig(config);

  const { baseUrl } = parseUrl(config.url);
  const dbUrl = buildDbUrl(baseUrl || config.url, config.database!);

  displayRestoreSummary(config, dbUrl);

  if (config.dryRun && handleDryRun()) return;
  if (!config.forceOverwrite && handleNoForceOverwrite()) return;

  await prepareDatabase(config);

  const shouldProceed = await getInteractiveConfirmation(isInteractive);
  if (!shouldProceed) return;

  try {
    await executeRestore(config, dbUrl);
  } catch (error) {
    console.error(chalk.red('\nRestore failed!'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Create non-interactive config from CLI options
 */
function createNonInteractiveConfig(options: Record<string, unknown>): RestoreConfig {
  if (!options.url) throw new Error('URL is required in non-interactive mode.');
  if (!options.backupFile) throw new Error('Backup file is required in non-interactive mode.');

  return {
    url: options.url as string,
    database: options.database as string | undefined,
    backupFile: options.backupFile as string,
    backupDir: (options.backupDir as string) || DEFAULT_CONFIG.backupDir,
    parallelism: (options.parallelism as number) ?? DEFAULT_CONFIG.parallelism,
    timeout: (options.timeout as number) ?? DEFAULT_CONFIG.timeout,
    dryRun: (options.dryRun as boolean) || false,
    forceOverwrite: (options.forceOverwrite as boolean) || false,
  };
}

// CLI setup
const program = new Command();

program
  .name('restore-interactive')
  .description('Interactive CouchDB restore tool')
  .version('1.0.0')
  .option('-u, --url <url>', 'CouchDB URL (e.g., http://admin:password@localhost:5984)')
  .option('-d, --database <name>', 'target database name for restore')
  .option('-f, --backup-file <path>', 'backup file to restore from')
  .option('-b, --backup-dir <path>', 'backup directory to search', DEFAULT_CONFIG.backupDir)
  .option(
    '-p, --parallelism <number>',
    'number of parallel connections',
    (val) => parseInt(val, 10),
    DEFAULT_CONFIG.parallelism,
  )
  .option(
    '-t, --timeout <ms>',
    'request timeout in milliseconds',
    (val) => parseInt(val, 10),
    DEFAULT_CONFIG.timeout,
  )
  .option('--dry-run', 'show what would be done without performing restore')
  .option('--force-overwrite', 'skip overwrite confirmation prompts')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      const config = options.interactive
        ? await getRestoreConfig(options)
        : createNonInteractiveConfig(options);

      await performRestore(config, options.interactive);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { getRestoreConfig, performRestore };
