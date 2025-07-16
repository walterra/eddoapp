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
import { validateEnv, getCouchDbConfig, getAvailableDatabases } from '@eddo/core-server/config';
import { 
  getAllBackupFiles,
  checkDatabaseExists,
  recreateDatabase,
  formatFileSize,
  formatDuration,
  parseBackupFilename,
  createRestoreOptions,
  DEFAULT_CONFIG,
  type RestoreOptions,
  type BackupFileInfo as BackupFileInfoBase
} from './backup-utils.js';

interface RestoreConfig {
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


function getBackupFiles(backupDir: string): BackupFileInfo[] {
  const allBackups = getAllBackupFiles(backupDir);
  
  return allBackups.map(backup => {
    const stats = fs.statSync(backup.path);
    const age = getRelativeTime(stats.mtime);
    
    return {
      filename: path.basename(backup.path),
      fullPath: backup.path,
      path: backup.path,
      database: backup.database,
      timestamp: backup.timestamp,
      size: backup.size,
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
  // Environment configuration
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Default values
  const defaults: RestoreConfig = {
    database: couchConfig.dbName,
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
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
    const spinner = ora('Recreating target database...').start();
    await recreateDatabase(config.database!, env.COUCHDB_URL);
    spinner.succeed(chalk.green(`Recreated empty target database: ${config.database}`));
  } catch (error) {
    console.error(chalk.red('Failed to recreate target database:'), error instanceof Error ? error.message : String(error));
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

      // Note: The readStream 'data' event won't give us accurate document count
      // as it's raw file chunks, not individual documents
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
  .option('-d, --database <name>', 'target database name for restore')
  .option('-f, --backup-file <path>', 'backup file to restore from')
  .option('-b, --backup-dir <path>', 'backup directory to search', DEFAULT_CONFIG.backupDir)
  .option('-p, --parallelism <number>', 'number of parallel connections', (val) => parseInt(val, 10), DEFAULT_CONFIG.parallelism)
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', (val) => parseInt(val, 10), DEFAULT_CONFIG.timeout)
  .option('--dry-run', 'show what would be done without performing restore')
  .option('--force-overwrite', 'skip overwrite confirmation prompts')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      let config: RestoreConfig;
      
      if (options.interactive) {
        config = await getRestoreConfig(options);
      } else {
        // In non-interactive mode, require explicit backup file parameter
        if (!options.backupFile) {
          throw new Error('Backup file parameter is required in non-interactive mode. Use --backup-file <path> or run without --no-interactive');
        }
        
        config = { 
          database: options.database || getCouchDbConfig(validateEnv(process.env)).dbName,
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

export { performRestore, getRestoreConfig };