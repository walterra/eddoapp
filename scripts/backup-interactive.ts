#!/usr/bin/env tsx

/**
 * Interactive backup script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import couchbackup from '@cloudant/couchbackup';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import prompts from 'prompts';
import {
  buildDbUrl,
  getBackupConfig,
  parseUrl,
  type BackupConfig,
} from './backup-interactive-prompts.js';
import {
  createBackupOptions,
  DEFAULT_CONFIG,
  ensureBackupDir,
  formatFileSize,
  generateBackupFilename,
  getAllBackupFiles,
} from './backup-utils.js';

async function listExistingBackups(backupDir: string, database: string): Promise<string[]> {
  const allBackups = getAllBackupFiles(backupDir);
  return allBackups
    .filter((backup) => backup.database === database)
    .map((backup) => path.basename(backup.path));
}

/**
 * Display backup configuration summary
 */
function displayBackupSummary(config: BackupConfig, dbUrl: string, backupFile: string): void {
  console.log('\n' + chalk.bold('Backup Configuration:'));
  console.log(`  Database: ${chalk.cyan(config.database)}`);
  console.log(`  Source: ${chalk.cyan(dbUrl)}`);
  console.log(`  Destination: ${chalk.cyan(backupFile)}`);
  console.log(`  Parallelism: ${chalk.cyan(config.parallelism)}`);
  console.log(`  Timeout: ${chalk.cyan(config.timeout + 'ms')}`);
}

/**
 * Display existing backups for the database
 */
async function displayExistingBackups(backupDir: string, database: string): Promise<void> {
  const existingBackups = await listExistingBackups(backupDir, database);
  if (existingBackups.length === 0) return;

  console.log(chalk.gray('\nExisting backups:'));
  existingBackups.slice(0, 5).forEach((file) => {
    const stats = fs.statSync(path.join(backupDir, file));
    console.log(chalk.gray(`  • ${file} (${formatFileSize(stats.size)})`));
  });
  if (existingBackups.length > 5) {
    console.log(chalk.gray(`  ... and ${existingBackups.length - 5} more`));
  }
}

/**
 * Execute the backup operation
 */
async function executeBackup(
  config: BackupConfig,
  dbUrl: string,
  backupFile: string,
): Promise<void> {
  const spinner = ora({
    text: 'Starting backup...',
    isSilent: !process.stdout.isTTY,
  }).start();

  if (!process.stdout.isTTY) console.log('Starting backup...');

  const startTime = Date.now();
  const writeStream = fs.createWriteStream(backupFile);

  const options = createBackupOptions({
    parallelism: config.parallelism,
    requestTimeout: config.timeout,
    logfile: `${backupFile}.log`,
  });

  let documentsProcessed = 0;

  const updateProgress = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.text = `Backing up... (${documentsProcessed} documents, ${elapsed}s)`;
  }, 1000);

  await new Promise<void>((resolve, reject) => {
    const backup = couchbackup.backup(dbUrl, writeStream, options, (err: Error | null) => {
      clearInterval(updateProgress);
      if (err) reject(err);
      else resolve();
    });

    backup.on('changes', (batch: number) => {
      documentsProcessed += batch;
    });
  });

  spinner.succeed(chalk.green('Backup completed successfully!'));

  const stats = fs.statSync(backupFile);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + chalk.bold('Backup Summary:'));
  console.log(`  File: ${chalk.cyan(backupFile)}`);
  console.log(`  Size: ${chalk.cyan(formatFileSize(stats.size))}`);
  console.log(`  Documents: ${chalk.cyan(documentsProcessed)}`);
  console.log(`  Duration: ${chalk.cyan(duration + 's')}`);

  if (fs.existsSync(`${backupFile}.log`)) {
    console.log(`  Log: ${chalk.gray(`${backupFile}.log`)}`);
  }
}

async function performBackup(config: BackupConfig, isInteractive: boolean = true): Promise<void> {
  if (!config.url) throw new Error('CouchDB URL is required');
  if (!config.database) throw new Error('Database name is required');

  const { baseUrl } = parseUrl(config.url);
  const dbUrl = buildDbUrl(baseUrl || config.url, config.database);

  await displayExistingBackups(config.backupDir, config.database);

  const backupFile = generateBackupFilename(config.database, config.backupDir);
  displayBackupSummary(config, dbUrl, backupFile);

  ensureBackupDir(config.backupDir);

  if (config.dryRun) {
    console.log(chalk.yellow('\n⚠️  Dry run mode - no backup will be performed'));
    return;
  }

  if (isInteractive) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with backup?',
      initial: true,
    });

    if (!confirm) {
      console.log(chalk.red('\nBackup cancelled.'));
      return;
    }
  }

  try {
    await executeBackup(config, dbUrl, backupFile);
  } catch (error) {
    console.error(chalk.red('\nBackup failed!'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Create non-interactive config from CLI options
 */
function createNonInteractiveConfig(options: Record<string, unknown>): BackupConfig {
  if (!options.url) throw new Error('URL is required in non-interactive mode.');
  if (!options.database) throw new Error('Database is required in non-interactive mode.');

  return {
    url: options.url as string,
    database: options.database as string,
    backupDir: (options.backupDir as string) || DEFAULT_CONFIG.backupDir,
    parallelism: (options.parallelism as number) ?? DEFAULT_CONFIG.parallelism,
    timeout: (options.timeout as number) ?? DEFAULT_CONFIG.timeout,
    dryRun: (options.dryRun as boolean) || false,
  };
}

// CLI setup
const program = new Command();

program
  .name('backup-interactive')
  .description('Interactive CouchDB backup tool')
  .version('1.0.0')
  .option('-u, --url <url>', 'CouchDB URL (e.g., http://admin:password@localhost:5984)')
  .option('-d, --database <name>', 'database name to backup')
  .option('-b, --backup-dir <path>', 'backup directory', DEFAULT_CONFIG.backupDir)
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
  .option('--dry-run', 'show what would be done without performing backup')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      const config = options.interactive
        ? await getBackupConfig(options)
        : createNonInteractiveConfig(options);

      await performBackup(config, options.interactive);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { getBackupConfig, performBackup };
