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
import path from 'path';
import prompts from 'prompts';
import {
  createRestoreOptions,
  DEFAULT_CONFIG,
  formatDuration,
  formatFileSize,
  getAllBackupFiles,
  recreateDatabase,
  type BackupFileInfo as BackupFileInfoBase,
} from './backup-utils.js';

interface RestoreConfig {
  url: string;
  database?: string;
  backupFile?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
  forceOverwrite: boolean;
}

interface BackupFileInfo extends BackupFileInfoBase {
  filename: string;
  fullPath: string;
  age: string;
}

/**
 * Parse CouchDB URL to extract components
 */
function parseUrl(url: string): { baseUrl: string; defaultDb?: string } {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const defaultDb = pathParts.length > 0 ? pathParts[0] : undefined;

  // Remove database from path to get base URL
  parsed.pathname = '/';
  return { baseUrl: parsed.toString().replace(/\/$/, ''), defaultDb };
}

/**
 * Build full database URL
 */
function buildDbUrl(baseUrl: string, database: string): string {
  return `${baseUrl}/${database}`;
}

/**
 * Fetch available databases from CouchDB
 */
async function fetchAvailableDatabases(baseUrl: string): Promise<string[]> {
  try {
    const parsed = new URL(baseUrl);
    const credentials =
      parsed.username && parsed.password
        ? Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64')
        : null;

    // Remove credentials from URL for fetch (fetch API doesn't allow credentials in URL)
    const cleanUrl = `${parsed.protocol}//${parsed.host}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${cleanUrl}/_all_dbs`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch databases: ${response.statusText}`);
    }

    const databases = (await response.json()) as string[];
    return databases.filter((db) => !db.startsWith('_'));
  } catch (error) {
    console.error(
      chalk.yellow('Warning: Could not fetch databases:'),
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

function getBackupFiles(backupDir: string): BackupFileInfo[] {
  const allBackups = getAllBackupFiles(backupDir);

  return allBackups.map((backup) => {
    const stats = fs.statSync(backup.path);
    const age = getRelativeTime(stats.mtime);

    return {
      filename: path.basename(backup.path),
      fullPath: backup.path,
      path: backup.path,
      database: backup.database,
      timestamp: backup.timestamp,
      size: formatFileSize(backup.size),
      age,
    };
  });
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
}

async function getRestoreConfig(options: Partial<RestoreConfig>): Promise<RestoreConfig> {
  // Default values
  const defaults: RestoreConfig = {
    url: '',
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
    dryRun: false,
    forceOverwrite: false,
  };

  console.log(chalk.blue('\n🔄 CouchDB Interactive Restore\n'));

  const questions: prompts.PromptObject[] = [];

  // URL prompt if not provided
  let baseUrl = '';
  let defaultDb: string | undefined;

  if (!options.url) {
    questions.push({
      type: 'text',
      name: 'url',
      message: 'CouchDB URL (e.g., http://admin:password@localhost:5984):',
      validate: (value: string) => {
        if (!value) return 'URL is required';
        try {
          new URL(value);
          return true;
        } catch {
          return 'Invalid URL format';
        }
      },
    });
  } else {
    const parsed = parseUrl(options.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  }

  // Backup file selection (do this first since it doesn't need URL)
  const backupDir = options.backupDir || defaults.backupDir;
  const backupFiles = getBackupFiles(backupDir);

  if (!options.backupFile) {
    if (backupFiles.length === 0) {
      console.log(chalk.yellow('⚠️  No backup files found'));
      console.log(chalk.gray('Please specify backup file path manually...'));

      questions.push({
        type: 'text',
        name: 'backupFile',
        message: 'Path to backup file:',
        validate: (value: string) => {
          if (!value) return 'Backup file path is required';
          if (!fs.existsSync(value)) return 'Backup file does not exist';
          return true;
        },
      });
    } else {
      const MAX_DISPLAY_BACKUPS = 50;
      const totalBackups = backupFiles.length;
      const displayBackups = backupFiles.slice(0, MAX_DISPLAY_BACKUPS);

      console.log(chalk.green(`✅ Found ${totalBackups} backup file(s)`));
      if (totalBackups > MAX_DISPLAY_BACKUPS) {
        console.log(
          chalk.yellow(
            `   Showing ${MAX_DISPLAY_BACKUPS} most recent. Use "Browse for custom backup file" for older backups.`,
          ),
        );
      }

      const backupChoices = [
        ...displayBackups.map((backup) => ({
          title: `${backup.filename}`,
          value: backup.fullPath,
          description: `${backup.database} | ${backup.size} | ${backup.age}`,
        })),
        {
          title: '📁 Browse for custom backup file',
          value: '__custom__',
          description: 'Manually specify backup file path',
        },
      ];

      questions.push({
        type: 'select',
        name: 'backupFile',
        message: 'Select backup file to restore:',
        choices: backupChoices,
      });

      questions.push({
        type: (prev: string) => (prev === '__custom__' ? 'text' : null),
        name: 'customBackupFile',
        message: 'Enter backup file path:',
        validate: (value: string) => {
          if (!value) return 'Backup file path is required';
          if (!fs.existsSync(value)) return 'Backup file does not exist';
          return true;
        },
      });
    }
  }

  // Run first batch of questions (URL and backup file)
  const firstAnswers = await prompts(questions, {
    onCancel: () => {
      console.log(chalk.red('\nRestore cancelled.'));
      process.exit(0);
    },
  });

  // Handle custom backup file selection
  if (firstAnswers.backupFile === '__custom__' && firstAnswers.customBackupFile) {
    firstAnswers.backupFile = firstAnswers.customBackupFile;
  }
  delete firstAnswers.customBackupFile;

  // If URL was prompted, parse it now
  if (firstAnswers.url) {
    const parsed = parseUrl(firstAnswers.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  }

  // Now fetch databases and prompt for target database
  const secondQuestions: prompts.PromptObject[] = [];

  if (!options.database) {
    const spinner = ora('Discovering available databases...').start();
    const availableDatabases = await fetchAvailableDatabases(baseUrl || options.url || '');
    spinner.stop();

    if (availableDatabases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
      console.log(chalk.gray('Falling back to manual input...'));

      secondQuestions.push({
        type: 'text',
        name: 'database',
        message: 'Target database name for restore:',
        initial: defaultDb,
      });
    } else {
      console.log(chalk.green(`✅ Found ${availableDatabases.length} database(s)`));

      const databaseChoices = [
        ...availableDatabases.map((db) => ({
          title: db,
          value: db,
          description: db === defaultDb ? '(from URL)' : '',
        })),
        {
          title: '📝 Enter custom database name',
          value: '__custom__',
          description: 'Manually type a database name',
        },
      ];

      const defaultIndex = defaultDb ? availableDatabases.findIndex((db) => db === defaultDb) : -1;
      secondQuestions.push({
        type: 'select',
        name: 'database',
        message: 'Select target database for restore:',
        choices: databaseChoices,
        initial: defaultIndex >= 0 ? defaultIndex : 0,
      });

      secondQuestions.push({
        type: (prev: string) => (prev === '__custom__' ? 'text' : null),
        name: 'customDatabase',
        message: 'Enter database name:',
        initial: defaultDb,
      });
    }
  }

  // Other configuration options
  if (options.parallelism === undefined) {
    secondQuestions.push({
      type: 'number',
      name: 'parallelism',
      message: 'Parallel connections:',
      initial: defaults.parallelism,
      min: 1,
      max: 10,
    });
  }

  if (options.timeout === undefined) {
    secondQuestions.push({
      type: 'number',
      name: 'timeout',
      message: 'Request timeout (ms):',
      initial: defaults.timeout,
      min: 10000,
    });
  }

  // Force overwrite confirmation
  secondQuestions.push({
    type: 'confirm',
    name: 'forceOverwrite',
    message: 'This will overwrite the target database. Continue?',
    initial: false,
  });

  const secondAnswers = await prompts(secondQuestions, {
    onCancel: () => {
      console.log(chalk.red('\nRestore cancelled.'));
      process.exit(0);
    },
  });

  // Handle custom database selection
  if (secondAnswers.database === '__custom__' && secondAnswers.customDatabase) {
    secondAnswers.database = secondAnswers.customDatabase;
  }
  delete secondAnswers.customDatabase;

  return {
    ...defaults,
    ...options,
    ...firstAnswers,
    ...secondAnswers,
    url: baseUrl || options.url || '',
  };
}

async function performRestore(config: RestoreConfig, isInteractive: boolean = true): Promise<void> {
  if (!config.url) {
    throw new Error('CouchDB URL is required');
  }

  if (!config.database) {
    throw new Error('Database name is required');
  }

  const { baseUrl } = parseUrl(config.url);
  const dbUrl = buildDbUrl(baseUrl || config.url, config.database);

  if (!config.backupFile || !fs.existsSync(config.backupFile)) {
    throw new Error(`Backup file does not exist: ${config.backupFile}`);
  }

  // Show restore summary
  const backupStats = fs.statSync(config.backupFile);

  console.log('\n' + chalk.bold('Restore Configuration:'));
  console.log(`  Backup File: ${chalk.cyan(config.backupFile)}`);
  console.log(`  File Size: ${chalk.cyan(formatFileSize(backupStats.size))}`);
  console.log(`  Target Database: ${chalk.cyan(config.database)}`);
  console.log(`  Destination: ${chalk.cyan(dbUrl)}`);
  console.log(`  Parallelism: ${chalk.cyan(config.parallelism)}`);
  console.log(`  Timeout: ${chalk.cyan(config.timeout + 'ms')}`);

  if (config.dryRun) {
    console.log(chalk.yellow('\n⚠️  Dry run mode - no restore will be performed'));
    return;
  }

  if (!config.forceOverwrite) {
    console.log(chalk.red('\n❌ Restore cancelled - force overwrite not confirmed'));
    return;
  }

  // Recreate target database to ensure it's empty (required by @cloudant/couchbackup)
  try {
    const spinner = ora({
      text: 'Recreating target database...',
      isSilent: !process.stdout.isTTY,
    }).start();
    if (!process.stdout.isTTY) {
      console.log('Recreating target database...');
    }
    await recreateDatabase(config.database, config.url);
    spinner.succeed(chalk.green(`Recreated empty target database: ${config.database}`));
  } catch (error) {
    console.error(
      chalk.red('Failed to recreate target database:'),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  // Final confirmation (only in interactive mode or when not forced)
  if (isInteractive) {
    const { finalConfirm } = await prompts({
      type: 'confirm',
      name: 'finalConfirm',
      message: chalk.red(
        '⚠️  WARNING: This will REPLACE ALL DATA in the target database. Are you absolutely sure?',
      ),
      initial: false,
    });

    if (!finalConfirm) {
      console.log(chalk.red('\nRestore cancelled.'));
      return;
    }
  }

  // Start restore with progress indicator
  // Disable spinner animation in non-TTY environments for better test output
  const spinner = ora({
    text: 'Starting restore...',
    isSilent: !process.stdout.isTTY,
  }).start();

  if (!process.stdout.isTTY) {
    console.log('Starting restore...');
  }

  try {
    const startTime = Date.now();
    const readStream = fs.createReadStream(config.backupFile);

    const options = createRestoreOptions({
      parallelism: config.parallelism,
      requestTimeout: config.timeout,
      logfile: `${config.backupFile}.restore.log`,
    });

    // Update spinner with progress
    const updateProgress = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.text = `Restoring... (${elapsed}s elapsed)`;
    }, 1000);

    await new Promise<void>((resolve, reject) => {
      couchbackup.restore(readStream, dbUrl, options, (err: Error | null) => {
        clearInterval(updateProgress);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    spinner.succeed(chalk.green('Restore completed successfully!'));

    // Display restore statistics
    const duration = Date.now() - startTime;

    console.log('\n' + chalk.bold('Restore Summary:'));
    console.log(`  Source: ${chalk.cyan(config.backupFile)}`);
    console.log(`  Target: ${chalk.cyan(config.database)}`);
    console.log(`  Duration: ${chalk.cyan(formatDuration(duration))}`);

    // Log file info
    if (fs.existsSync(`${config.backupFile}.restore.log`)) {
      console.log(`  Log: ${chalk.gray(`${config.backupFile}.restore.log`)}`);
    }
  } catch (error) {
    spinner.fail(chalk.red('Restore failed!'));
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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
      let config: RestoreConfig;

      if (options.interactive) {
        config = await getRestoreConfig(options);
      } else {
        // In non-interactive mode, require explicit parameters
        if (!options.url) {
          throw new Error(
            'URL is required in non-interactive mode. Use --url <url> or run without --no-interactive',
          );
        }
        if (!options.backupFile) {
          throw new Error(
            'Backup file is required in non-interactive mode. Use --backup-file <path> or run without --no-interactive',
          );
        }

        config = {
          url: options.url,
          database: options.database,
          backupFile: options.backupFile,
          backupDir: options.backupDir || DEFAULT_CONFIG.backupDir,
          parallelism: options.parallelism ?? DEFAULT_CONFIG.parallelism,
          timeout: options.timeout ?? DEFAULT_CONFIG.timeout,
          dryRun: options.dryRun || false,
          forceOverwrite: options.forceOverwrite || false,
        };
      }

      await performRestore(config, options.interactive);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { getRestoreConfig, performRestore };
