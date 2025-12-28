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
  createBackupOptions,
  DEFAULT_CONFIG,
  ensureBackupDir,
  formatFileSize,
  generateBackupFilename,
  getAllBackupFiles,
} from './backup-utils.js';

interface BackupConfig {
  url: string;
  database?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
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

async function getBackupConfig(options: Partial<BackupConfig>): Promise<BackupConfig> {
  // Default values
  const defaults: BackupConfig = {
    url: '',
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
    dryRun: false,
  };

  // If all required options are provided, return them without prompting
  if (
    options.url &&
    options.database &&
    options.backupDir !== undefined &&
    options.parallelism !== undefined &&
    options.timeout !== undefined
  ) {
    const { baseUrl } = parseUrl(options.url);
    return {
      ...defaults,
      ...options,
      url: baseUrl || options.url,
    } as BackupConfig;
  }

  console.log(chalk.blue('\n🗄️  CouchDB Interactive Backup\n'));

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

  // If we have URL already, fetch databases
  if (baseUrl) {
    const spinner = ora('Discovering available databases...').start();
    const availableDatabases = await fetchAvailableDatabases(baseUrl);
    spinner.stop();

    if (!options.database) {
      if (availableDatabases.length === 0) {
        console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
        console.log(chalk.gray('Falling back to manual input...'));

        questions.push({
          type: 'text',
          name: 'database',
          message: 'Database name to backup:',
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

        const defaultIndex = defaultDb
          ? availableDatabases.findIndex((db) => db === defaultDb)
          : -1;
        questions.push({
          type: 'select',
          name: 'database',
          message: 'Select database to backup:',
          choices: databaseChoices,
          initial: defaultIndex >= 0 ? defaultIndex : 0,
        });

        questions.push({
          type: (prev: string) => (prev === '__custom__' ? 'text' : null),
          name: 'customDatabase',
          message: 'Enter database name:',
          initial: defaultDb,
        });
      }
    }
  }

  if (options.backupDir === undefined) {
    questions.push({
      type: 'text',
      name: 'backupDir',
      message: 'Backup directory:',
      initial: defaults.backupDir,
    });
  }

  if (options.parallelism === undefined) {
    questions.push({
      type: 'number',
      name: 'parallelism',
      message: 'Parallel connections:',
      initial: defaults.parallelism,
      min: 1,
      max: 10,
    });
  }

  if (options.timeout === undefined) {
    questions.push({
      type: 'number',
      name: 'timeout',
      message: 'Request timeout (ms):',
      initial: defaults.timeout,
      min: 10000,
    });
  }

  const answers = await prompts(questions, {
    onCancel: () => {
      console.log(chalk.red('\nBackup cancelled.'));
      process.exit(0);
    },
  });

  // Handle URL if it was prompted
  if (answers.url) {
    const parsed = parseUrl(answers.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;

    // Now fetch databases and prompt for selection
    const spinner = ora('Discovering available databases...').start();
    const availableDatabases = await fetchAvailableDatabases(baseUrl);
    spinner.stop();

    if (availableDatabases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found'));
      const dbAnswer = await prompts({
        type: 'text',
        name: 'database',
        message: 'Database name to backup:',
        initial: defaultDb,
      });
      answers.database = dbAnswer.database;
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
      const dbAnswer = await prompts(
        {
          type: 'select',
          name: 'database',
          message: 'Select database to backup:',
          choices: databaseChoices,
          initial: defaultIndex >= 0 ? defaultIndex : 0,
        },
        {
          onCancel: () => {
            console.log(chalk.red('\nBackup cancelled.'));
            process.exit(0);
          },
        },
      );

      if (dbAnswer.database === '__custom__') {
        const customDb = await prompts({
          type: 'text',
          name: 'database',
          message: 'Enter database name:',
          initial: defaultDb,
        });
        answers.database = customDb.database;
      } else {
        answers.database = dbAnswer.database;
      }
    }
  }

  // Handle custom database selection
  if (answers.database === '__custom__' && answers.customDatabase) {
    answers.database = answers.customDatabase;
  }
  delete answers.customDatabase;

  return {
    ...defaults,
    ...options,
    ...answers,
    url: baseUrl || options.url || '',
  };
}

async function listExistingBackups(backupDir: string, database: string): Promise<string[]> {
  const allBackups = getAllBackupFiles(backupDir);
  return allBackups
    .filter((backup) => backup.database === database)
    .map((backup) => path.basename(backup.path));
}

async function performBackup(config: BackupConfig, isInteractive: boolean = true): Promise<void> {
  if (!config.url) {
    throw new Error('CouchDB URL is required');
  }

  if (!config.database) {
    throw new Error('Database name is required');
  }

  const { baseUrl } = parseUrl(config.url);
  const dbUrl = buildDbUrl(baseUrl || config.url, config.database);

  // Show existing backups
  const existingBackups = await listExistingBackups(config.backupDir, config.database);
  if (existingBackups.length > 0) {
    console.log(chalk.gray('\nExisting backups:'));
    existingBackups.slice(0, 5).forEach((file) => {
      const stats = fs.statSync(path.join(config.backupDir, file));
      console.log(chalk.gray(`  • ${file} (${formatFileSize(stats.size)})`));
    });
    if (existingBackups.length > 5) {
      console.log(chalk.gray(`  ... and ${existingBackups.length - 5} more`));
    }
  }

  // Generate backup filename
  const backupFile = generateBackupFilename(config.database, config.backupDir);

  console.log('\n' + chalk.bold('Backup Configuration:'));
  console.log(`  Database: ${chalk.cyan(config.database)}`);
  console.log(`  Source: ${chalk.cyan(dbUrl)}`);
  console.log(`  Destination: ${chalk.cyan(backupFile)}`);
  console.log(`  Parallelism: ${chalk.cyan(config.parallelism)}`);
  console.log(`  Timeout: ${chalk.cyan(config.timeout + 'ms')}`);

  // Ensure backup directory exists (even in dry run mode for validation)
  ensureBackupDir(config.backupDir);

  if (config.dryRun) {
    console.log(chalk.yellow('\n⚠️  Dry run mode - no backup will be performed'));
    return;
  }

  // Confirm before proceeding (only in interactive mode)
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

  // Start backup with progress indicator
  const spinner = ora('Starting backup...').start();

  try {
    const startTime = Date.now();
    const writeStream = fs.createWriteStream(backupFile);

    const options = createBackupOptions({
      parallelism: config.parallelism,
      requestTimeout: config.timeout,
      logfile: `${backupFile}.log`,
    });

    let documentsProcessed = 0;

    // Update spinner with progress
    const updateProgress = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.text = `Backing up... (${documentsProcessed} documents, ${elapsed}s)`;
    }, 1000);

    await new Promise<void>((resolve, reject) => {
      const backup = couchbackup.backup(dbUrl, writeStream, options, (err: Error | null) => {
        clearInterval(updateProgress);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      // Track progress
      backup.on('changes', (batch: number) => {
        documentsProcessed += batch;
      });
    });

    spinner.succeed(chalk.green('Backup completed successfully!'));

    // Display backup statistics
    const stats = fs.statSync(backupFile);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + chalk.bold('Backup Summary:'));
    console.log(`  File: ${chalk.cyan(backupFile)}`);
    console.log(`  Size: ${chalk.cyan(formatFileSize(stats.size))}`);
    console.log(`  Documents: ${chalk.cyan(documentsProcessed)}`);
    console.log(`  Duration: ${chalk.cyan(duration + 's')}`);

    // Log file info
    if (fs.existsSync(`${backupFile}.log`)) {
      console.log(`  Log: ${chalk.gray(`${backupFile}.log`)}`);
    }
  } catch (error) {
    spinner.fail(chalk.red('Backup failed!'));
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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
      let config: BackupConfig;

      if (options.interactive) {
        config = await getBackupConfig(options);
      } else {
        // In non-interactive mode, require explicit parameters
        if (!options.url) {
          throw new Error(
            'URL is required in non-interactive mode. Use --url <url> or run without --no-interactive',
          );
        }
        if (!options.database) {
          throw new Error(
            'Database is required in non-interactive mode. Use --database <name> or run without --no-interactive',
          );
        }

        config = {
          url: options.url,
          database: options.database,
          backupDir: options.backupDir || DEFAULT_CONFIG.backupDir,
          parallelism: options.parallelism ?? DEFAULT_CONFIG.parallelism,
          timeout: options.timeout ?? DEFAULT_CONFIG.timeout,
          dryRun: options.dryRun || false,
        };
      }

      await performBackup(config, options.interactive);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { getBackupConfig, performBackup };
