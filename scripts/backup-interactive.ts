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
import { validateEnv, getCouchDbConfig, getAvailableDatabases } from '@eddo/shared/config';
import { 
  ensureBackupDir, 
  generateBackupFilename, 
  formatFileSize,
  formatDuration,
  createBackupOptions,
  getAllBackupFiles,
  DEFAULT_CONFIG,
  type BackupOptions
} from './backup-utils.js';

interface BackupConfig {
  database?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
}

async function getBackupConfig(options: Partial<BackupConfig>): Promise<BackupConfig> {
  // Environment configuration
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Default values
  const defaults: BackupConfig = {
    database: couchConfig.dbName,
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
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
    // Discover available databases
    const spinner = ora('Discovering available databases...').start();
    const availableDatabases = await getAvailableDatabases(env);
    spinner.stop();

    if (availableDatabases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
      console.log(chalk.gray('Falling back to manual input...'));
      
      questions.push({
        type: 'text',
        name: 'database',
        message: 'Database name to backup:',
        initial: defaults.database,
      });
    } else {
      console.log(chalk.green(`✅ Found ${availableDatabases.length} database(s)`));
      
      // Add option to enter custom database name
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
        message: 'Select database to backup:',
        choices: databaseChoices,
        initial: availableDatabases.findIndex(db => db === defaults.database),
      });

      // If user selects custom, ask for manual input
      questions.push({
        type: (prev: string) => prev === '__custom__' ? 'text' : null,
        name: 'customDatabase',
        message: 'Enter database name:',
        initial: defaults.database,
      });
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

  // Handle custom database selection
  if (answers.database === '__custom__' && answers.customDatabase) {
    answers.database = answers.customDatabase;
  }
  delete answers.customDatabase;

  return { ...defaults, ...options, ...answers };
}

async function listExistingBackups(backupDir: string, database: string): Promise<string[]> {
  const allBackups = getAllBackupFiles(backupDir);
  return allBackups
    .filter(backup => backup.database === database)
    .map(backup => path.basename(backup.path));
}

async function performBackup(config: BackupConfig, isInteractive: boolean = true): Promise<void> {
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
      console.log(chalk.gray(`  • ${file} (${formatFileSize(stats.size)})`));
    });
    if (existingBackups.length > 5) {
      console.log(chalk.gray(`  ... and ${existingBackups.length - 5} more`));
    }
  }

  // Generate backup filename
  const backupFile = generateBackupFilename(config.database!, config.backupDir);

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
  .option('-d, --database <name>', 'database name to backup')
  .option('-b, --backup-dir <path>', 'backup directory', DEFAULT_CONFIG.backupDir)
  .option('-p, --parallelism <number>', 'number of parallel connections', (val) => parseInt(val, 10), DEFAULT_CONFIG.parallelism)
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', (val) => parseInt(val, 10), DEFAULT_CONFIG.timeout)
  .option('--dry-run', 'show what would be done without performing backup')
  .option('--no-interactive', 'disable interactive prompts')
  .action(async (options) => {
    try {
      let config: BackupConfig;
      
      if (options.interactive) {
        config = await getBackupConfig(options);
      } else {
        // In non-interactive mode, require explicit database parameter
        if (!options.database) {
          throw new Error('Database parameter is required in non-interactive mode. Use --database <name> or run without --no-interactive');
        }
        
        config = { 
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

export { performBackup, getBackupConfig };