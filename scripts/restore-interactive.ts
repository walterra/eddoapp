#!/usr/bin/env tsx

/**
 * Interactive restore script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import couchbackup from '@cloudant/couchbackup';
import { validateEnv, getCouchDbConfig, getAvailableDatabases } from '@eddo/shared/config';

interface RestoreConfig {
  database?: string;
  backupFile?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
  forceOverwrite: boolean;
}

interface RestoreOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

interface BackupFileInfo {
  filename: string;
  fullPath: string;
  database: string;
  timestamp: string;
  size: string;
  age: string;
}

function parseBackupFilename(filename: string): { database: string; timestamp: string } | null {
  // Match pattern: database-YYYY-MM-DDTHH-mm-ss-sssZ.json
  const match = filename.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
  if (match) {
    return {
      database: match[1],
      timestamp: match[2],
    };
  }
  return null;
}

function getBackupFiles(backupDir: string): BackupFileInfo[] {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json') && !file.endsWith('.log'))
    .map(filename => {
      const fullPath = path.join(backupDir, filename);
      const stats = fs.statSync(fullPath);
      const parsed = parseBackupFilename(filename);
      
      if (!parsed) return null;

      const size = (stats.size / 1024 / 1024).toFixed(2);
      const age = getRelativeTime(stats.mtime);

      return {
        filename,
        fullPath,
        database: parsed.database,
        timestamp: parsed.timestamp,
        size: `${size} MB`,
        age,
      };
    })
    .filter((item): item is BackupFileInfo => item !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Most recent first

  return files;
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
  // Environment configuration
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Default values
  const defaults: RestoreConfig = {
    database: couchConfig.dbName,
    backupDir: process.env.BACKUP_DIR || './backups',
    parallelism: 5,
    timeout: 60000,
    dryRun: false,
    forceOverwrite: false,
  };

  // If all required options are provided, return them
  if (options.database && options.backupFile && options.backupDir !== undefined) {
    return { ...defaults, ...options };
  }

  // Otherwise, prompt for missing values
  console.log(chalk.blue('\n🔄 CouchDB Interactive Restore\n'));
  
  const questions: prompts.PromptObject[] = [];
  
  // Database selection
  if (!options.database) {
    const spinner = ora('Discovering available databases...').start();
    const availableDatabases = await getAvailableDatabases(env);
    spinner.stop();

    if (availableDatabases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
      console.log(chalk.gray('Falling back to manual input...'));
      
      questions.push({
        type: 'text',
        name: 'database',
        message: 'Target database name for restore:',
        initial: defaults.database,
      });
    } else {
      console.log(chalk.green(`✅ Found ${availableDatabases.length} database(s)`));
      
      const databaseChoices = [
        ...availableDatabases.map(db => ({
          title: db,
          value: db,
          description: db === defaults.database ? '(current default)' : '',
        })),
        {
          title: '📝 Enter custom database name',
          value: '__custom__',
          description: 'Manually type a database name',
        },
      ];

      questions.push({
        type: 'select',
        name: 'database',
        message: 'Select target database for restore:',
        choices: databaseChoices,
        initial: availableDatabases.findIndex(db => db === defaults.database),
      });

      questions.push({
        type: (prev: string) => prev === '__custom__' ? 'text' : null,
        name: 'customDatabase',
        message: 'Enter database name:',
        initial: defaults.database,
      });
    }
  }

  // Backup file selection
  if (!options.backupFile) {
    const backupFiles = getBackupFiles(options.backupDir || defaults.backupDir);
    
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
      console.log(chalk.green(`✅ Found ${backupFiles.length} backup file(s)`));
      
      const backupChoices = [
        ...backupFiles.map(backup => ({
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
        type: (prev: string) => prev === '__custom__' ? 'text' : null,
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

  // Other configuration options
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

  // Force overwrite confirmation
  questions.push({
    type: 'confirm',
    name: 'forceOverwrite',
    message: 'This will overwrite the target database. Continue?',
    initial: false,
  });

  const answers = await prompts(questions, {
    onCancel: () => {
      console.log(chalk.red('\nRestore cancelled.'));
      process.exit(0);
    },
  });

  // Handle custom selections
  if (answers.database === '__custom__' && answers.customDatabase) {
    answers.database = answers.customDatabase;
  }
  if (answers.backupFile === '__custom__' && answers.customBackupFile) {
    answers.backupFile = answers.customBackupFile;
  }
  delete answers.customDatabase;
  delete answers.customBackupFile;

  return { ...defaults, ...options, ...answers };
}

async function performRestore(config: RestoreConfig, isInteractive: boolean = true): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Use the database from config
  const dbUrl = couchConfig.fullUrl.replace(couchConfig.dbName, config.database || couchConfig.dbName);
  
  if (!config.backupFile || !fs.existsSync(config.backupFile)) {
    throw new Error(`Backup file does not exist: ${config.backupFile}`);
  }

  // Show restore summary
  const backupStats = fs.statSync(config.backupFile);
  
  console.log('\n' + chalk.bold('Restore Configuration:'));
  console.log(`  Backup File: ${chalk.cyan(config.backupFile)}`);
  console.log(`  File Size: ${chalk.cyan((backupStats.size / 1024 / 1024).toFixed(2) + ' MB')}`);
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

  // Create target database if it doesn't exist
  try {
    const spinner = ora('Checking/creating target database...').start();
    const url = new URL(env.COUCHDB_URL);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Check if database exists
    const checkResponse = await fetch(`${baseUrl}/${config.database}`, {
      method: 'HEAD',
      headers,
    });

    if (checkResponse.status === 404) {
      // Database doesn't exist, create it
      const createResponse = await fetch(`${baseUrl}/${config.database}`, {
        method: 'PUT',
        headers,
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create database: ${createResponse.statusText}`);
      }
      spinner.succeed(chalk.green(`Created target database: ${config.database}`));
    } else if (checkResponse.ok) {
      spinner.succeed(chalk.green(`Target database exists: ${config.database}`));
    } else {
      throw new Error(`Failed to check database: ${checkResponse.statusText}`);
    }
  } catch (error) {
    console.error(chalk.red('Failed to create/check target database:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Final confirmation (only in interactive mode or when not forced)
  if (isInteractive || !config.forceOverwrite) {
    const { finalConfirm } = await prompts({
      type: 'confirm',
      name: 'finalConfirm',
      message: chalk.red('⚠️  WARNING: This will REPLACE ALL DATA in the target database. Are you absolutely sure?'),
      initial: false,
    });

    if (!finalConfirm) {
      console.log(chalk.red('\nRestore cancelled.'));
      return;
    }
  }

  // Start restore with progress indicator
  const spinner = ora('Starting restore...').start();
  
  try {
    const startTime = Date.now();
    const readStream = fs.createReadStream(config.backupFile);
    
    const options: RestoreOptions = {
      parallelism: config.parallelism,
      requestTimeout: config.timeout,
      logfile: `${config.backupFile}.restore.log`,
    };

    let documentsProcessed = 0;

    // Update spinner with progress
    const updateProgress = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.text = `Restoring... (${documentsProcessed} documents processed, ${elapsed}s)`;
    }, 1000);

    await new Promise<void>((resolve, reject) => {
      couchbackup.restore(
        readStream,
        dbUrl,
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

      // Track progress if possible
      readStream.on('data', () => {
        documentsProcessed += 1;
      });
    });

    spinner.succeed(chalk.green('Restore completed successfully!'));

    // Display restore statistics
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + chalk.bold('Restore Summary:'));
    console.log(`  Source: ${chalk.cyan(config.backupFile)}`);
    console.log(`  Target: ${chalk.cyan(config.database)}`);
    console.log(`  Duration: ${chalk.cyan(duration + 's')}`);
    
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
  .option('-d, --database <name>', 'target database name for restore')
  .option('-f, --backup-file <path>', 'backup file to restore from')
  .option('-b, --backup-dir <path>', 'backup directory to search', process.env.BACKUP_DIR || './backups')
  .option('-p, --parallelism <number>', 'number of parallel connections', parseInt, 5)
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', parseInt, 60000)
  .option('--dry-run', 'show what would be done without performing restore')
  .option('--force-overwrite', 'skip overwrite confirmation prompts')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      const config = options.interactive 
        ? await getRestoreConfig(options)
        : { 
            database: options.database || getCouchDbConfig(validateEnv(process.env)).dbName,
            backupFile: options.backupFile,
            backupDir: options.backupDir,
            parallelism: options.parallelism,
            timeout: options.timeout,
            dryRun: options.dryRun || false,
            forceOverwrite: options.forceOverwrite || false,
          };
      
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

export { performRestore, getRestoreConfig };