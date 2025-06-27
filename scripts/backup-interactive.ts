#!/usr/bin/env tsx

/**
 * Interactive backup script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig } from '@eddo/shared/config';

interface BackupConfig {
  database?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
}

interface BackupOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

async function getBackupConfig(options: Partial<BackupConfig>): Promise<BackupConfig> {
  // Environment configuration
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Default values
  const defaults: BackupConfig = {
    database: couchConfig.dbName,
    backupDir: process.env.BACKUP_DIR || './backups',
    parallelism: 5,
    timeout: 60000,
    dryRun: false,
  };

  // If all required options are provided, return them
  if (options.database && options.backupDir !== undefined) {
    return { ...defaults, ...options };
  }

  // Otherwise, prompt for missing values
  console.log(chalk.blue('\n🗄️  CouchDB Interactive Backup\n'));
  
  const questions: prompts.PromptObject[] = [];
  
  if (!options.database) {
    questions.push({
      type: 'text',
      name: 'database',
      message: 'Database name to backup:',
      initial: defaults.database,
    });
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

  return { ...defaults, ...options, ...answers };
}

async function listExistingBackups(backupDir: string, database: string): Promise<string[]> {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs.readdirSync(backupDir)
    .filter((file) => file.startsWith(`${database}-`) && file.endsWith('.json'))
    .sort()
    .reverse();
}

async function performBackup(config: BackupConfig): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Use the database from config, not from env
  const dbUrl = couchConfig.fullUrl.replace(couchConfig.dbName, config.database || couchConfig.dbName);
  
  // Show existing backups
  const existingBackups = await listExistingBackups(config.backupDir, config.database || couchConfig.dbName);
  if (existingBackups.length > 0) {
    console.log(chalk.gray('\nExisting backups:'));
    existingBackups.slice(0, 5).forEach((file) => {
      const stats = fs.statSync(path.join(config.backupDir, file));
      const size = (stats.size / 1024 / 1024).toFixed(2);
      console.log(chalk.gray(`  • ${file} (${size} MB)`));
    });
    if (existingBackups.length > 5) {
      console.log(chalk.gray(`  ... and ${existingBackups.length - 5} more`));
    }
  }

  // Generate backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(config.backupDir, `${config.database}-${timestamp}.json`);

  console.log('\n' + chalk.bold('Backup Configuration:'));
  console.log(`  Database: ${chalk.cyan(config.database)}`);
  console.log(`  Source: ${chalk.cyan(dbUrl)}`);
  console.log(`  Destination: ${chalk.cyan(backupFile)}`);
  console.log(`  Parallelism: ${chalk.cyan(config.parallelism)}`);
  console.log(`  Timeout: ${chalk.cyan(config.timeout + 'ms')}`);

  if (config.dryRun) {
    console.log(chalk.yellow('\n⚠️  Dry run mode - no backup will be performed'));
    return;
  }

  // Confirm before proceeding
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

  // Ensure backup directory exists
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }

  // Start backup with progress indicator
  const spinner = ora('Starting backup...').start();
  
  try {
    const startTime = Date.now();
    const writeStream = fs.createWriteStream(backupFile);
    
    const options: BackupOptions = {
      parallelism: config.parallelism,
      requestTimeout: config.timeout,
      logfile: `${backupFile}.log`,
    };

    let documentsProcessed = 0;
    let lastUpdate = Date.now();

    // Update spinner with progress
    const updateProgress = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.text = `Backing up... (${documentsProcessed} documents, ${elapsed}s)`;
    }, 1000);

    await new Promise<void>((resolve, reject) => {
      const backup = couchbackup.backup(
        dbUrl,
        writeStream,
        options,
        (err: Error | null) => {
          clearInterval(updateProgress);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );

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
    console.log(`  Size: ${chalk.cyan((stats.size / 1024 / 1024).toFixed(2) + ' MB')}`);
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
  .option('-d, --database <name>', 'database name to backup')
  .option('-b, --backup-dir <path>', 'backup directory', process.env.BACKUP_DIR || './backups')
  .option('-p, --parallelism <number>', 'number of parallel connections', parseInt, 5)
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', parseInt, 60000)
  .option('--dry-run', 'show what would be done without performing backup')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      const config = options.interactive 
        ? await getBackupConfig(options)
        : { 
            database: options.database || getCouchDbConfig(validateEnv(process.env)).dbName,
            backupDir: options.backupDir,
            parallelism: options.parallelism,
            timeout: options.timeout,
            dryRun: options.dryRun || false,
          };
      
      await performBackup(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { performBackup, getBackupConfig };