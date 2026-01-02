/**
 * Helper functions for replication scripts
 */
import { getAvailableDatabases, validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import nano from 'nano';
import ora from 'ora';
import prompts from 'prompts';

import { checkDatabaseExists, formatDuration } from './backup-utils.js';

export interface ReplicationConfig {
  source?: string;
  target?: string;
  continuous: boolean;
  createTarget: boolean;
}

/**
 * Create database selection prompts
 */
function createDatabasePrompts(
  availableDatabases: string[],
  fieldName: 'source' | 'target',
): prompts.PromptObject[] {
  const questions: prompts.PromptObject[] = [];
  const message = fieldName === 'source' ? 'Select source database:' : 'Select target database:';
  const manualMessage = `Enter ${fieldName} database name:`;

  if (availableDatabases.length === 0) {
    questions.push({
      type: 'text',
      name: fieldName,
      message: manualMessage,
      validate: (value: string) => value.length > 0 || 'Database name is required',
    });
  } else {
    const choices = [
      ...availableDatabases.map((db) => ({ title: db, value: db })),
      { title: '📝 Enter custom database name', value: '__custom__' },
    ];

    questions.push({
      type: 'select',
      name: fieldName,
      message,
      choices,
    });

    questions.push({
      type: (prev) => (prev === '__custom__' ? 'text' : null),
      name: fieldName,
      message: manualMessage,
      validate: (value: string) => value.length > 0 || 'Database name is required',
    });
  }

  return questions;
}

/**
 * Get replication configuration interactively
 */
export async function getReplicationConfig(
  options: Partial<ReplicationConfig>,
): Promise<ReplicationConfig> {
  const env = validateEnv(process.env);
  const defaults: ReplicationConfig = { continuous: false, createTarget: true };

  if (options.source && options.target) {
    return { ...defaults, ...options };
  }

  console.log(chalk.blue('\n🔄 CouchDB Interactive Replication\n'));

  const spinner = ora('Discovering available databases...').start();
  const availableDatabases = await getAvailableDatabases(env);
  spinner.stop();

  if (availableDatabases.length > 0) {
    console.log(chalk.green(`✅ Found ${availableDatabases.length} database(s)\n`));
  } else {
    console.log(chalk.yellow('⚠️  No databases found'));
  }

  const questions: prompts.PromptObject[] = [];

  if (!options.source) {
    questions.push(...createDatabasePrompts(availableDatabases, 'source'));
  }

  if (!options.target) {
    questions.push(...createDatabasePrompts(availableDatabases, 'target'));
  }

  questions.push({
    type: 'confirm',
    name: 'continuous',
    message: 'Enable continuous replication?',
    initial: defaults.continuous,
  });

  const answers = await prompts(questions);

  if (!answers.source || !answers.target) {
    console.log(chalk.red('\n✗ Replication cancelled'));
    process.exit(0);
  }

  return { ...defaults, ...answers };
}

/**
 * Ensure target database exists
 */
export async function ensureTargetDatabase(
  target: string,
  couchUrl: string,
  createTarget: boolean,
): Promise<boolean> {
  const spinner = ora('Checking target database...').start();
  const targetInfo = await checkDatabaseExists(target, couchUrl);

  if (!targetInfo.exists) {
    if (createTarget) {
      spinner.warn(chalk.yellow(`Target database '${target}' does not exist`));
      spinner.start(`Creating target database '${target}'...`);
      const couch = nano(couchUrl);
      await couch.db.create(target);
      spinner.succeed(`Target database '${target}' created`);
      return true;
    } else {
      spinner.fail(chalk.red(`Target database '${target}' does not exist`));
      return false;
    }
  }

  spinner.succeed(`Target database '${target}' found (${targetInfo.docCount} documents)`);

  if (targetInfo.docCount > 0) {
    console.log(chalk.yellow(`\n⚠️  Target contains ${targetInfo.docCount} existing documents`));
    console.log(chalk.gray('These will be preserved and updated/merged with source data\n'));
  }

  return true;
}

/** Display replication history stats */
function displayHistoryStats(history: nano.DatabaseReplicateHistoryItem): void {
  console.log(`Documents written: ${chalk.cyan(history.docs_written || 0)}`);
  console.log(`Documents read: ${chalk.cyan(history.docs_read || 0)}`);
  console.log(`Missing documents: ${chalk.cyan(history.missing_checked || 0)}`);
  console.log(`Errors: ${chalk.red(history.doc_write_failures || 0)}`);
}

/** Display success result details */
function displaySuccessDetails(
  result: nano.DatabaseReplicateResponse,
  config: ReplicationConfig,
  duration: number,
): void {
  console.log(`Status: ${chalk.green('✓ Success')}`);

  if (result.history && result.history.length > 0) {
    displayHistoryStats(result.history[0]);
  }

  if (config.continuous) {
    console.log(`\n${chalk.yellow('ℹ️  Continuous replication is running in the background')}`);
    console.log(`Replication ID: ${chalk.cyan(result._id || 'N/A')}`);
  } else {
    console.log(`Duration: ${chalk.cyan(formatDuration(duration))}`);
  }
}

/** Display failure result details */
function displayFailureDetails(result: nano.DatabaseReplicateResponse): void {
  console.log(`Status: ${chalk.red('✗ Failed')}`);
  if (result.errors) {
    console.log(`Errors: ${chalk.red(JSON.stringify(result.errors, null, 2))}`);
  }
}

/**
 * Display replication results
 */
export function displayReplicationResults(
  result: nano.DatabaseReplicateResponse,
  config: ReplicationConfig,
  duration: number,
): void {
  console.log();
  console.log(chalk.bold('📊 Replication Summary:'));

  if (result.ok) {
    displaySuccessDetails(result, config, duration);
  } else {
    displayFailureDetails(result);
  }
}

/**
 * Display helpful error messages
 */
export function displayErrorHelp(error: Error): void {
  if (error.message.includes('ECONNREFUSED')) {
    console.error(chalk.yellow('\nℹ️  Make sure CouchDB is running and accessible'));
  } else if (error.message.includes('unauthorized')) {
    console.error(
      chalk.yellow('\nℹ️  Check your CouchDB credentials in the environment variables'),
    );
  }
}
