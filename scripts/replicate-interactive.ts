#!/usr/bin/env tsx

/**
 * Interactive CouchDB replication script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import { Command } from 'commander';
import nano from 'nano';
import ora, { type Ora } from 'ora';
import prompts from 'prompts';

import { checkDatabaseExists } from './backup-utils.js';
import {
  displayErrorHelp,
  displayReplicationResults,
  ensureTargetDatabase,
  getReplicationConfig,
  type ReplicationConfig,
} from './replicate-helpers.js';

/**
 * Log replication configuration
 */
function logConfiguration(config: ReplicationConfig): void {
  console.log(chalk.bold('\n📋 Replication Configuration:'));
  console.log(`Source: ${chalk.cyan(config.source)}`);
  console.log(`Target: ${chalk.cyan(config.target)}`);
  console.log(`Mode: ${config.continuous ? chalk.yellow('Continuous') : chalk.green('One-time')}`);
  console.log();
}

/**
 * Validate source database exists
 */
async function validateSource(source: string, couchUrl: string, spinner: Ora): Promise<boolean> {
  spinner.start('Checking source database...');
  const sourceInfo = await checkDatabaseExists(source, couchUrl);

  if (!sourceInfo.exists) {
    spinner.fail(chalk.red(`Source database '${source}' does not exist`));
    return false;
  }

  spinner.succeed(`Source database '${source}' found (${sourceInfo.docCount} documents)`);
  return true;
}

/**
 * Prompt user for confirmation
 */
async function confirmReplication(): Promise<boolean> {
  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Proceed with replication?',
    initial: true,
  });

  if (!proceed) {
    console.log(chalk.red('\n✗ Replication cancelled'));
  }

  return proceed;
}

/**
 * Execute replication operation
 */
async function executeReplication(
  config: ReplicationConfig,
  couchUrl: string,
  spinner: Ora,
): Promise<{ result: nano.DatabaseReplicateResponse; duration: number }> {
  spinner.start('Starting replication...');
  const startTime = Date.now();

  const couch = nano(couchUrl);
  const result = await couch.db.replicate(config.source!, config.target!, {
    create_target: false,
    continuous: config.continuous,
  });

  const duration = Date.now() - startTime;
  spinner.succeed(`Replication ${config.continuous ? 'started' : 'completed'} successfully`);

  return { result, duration };
}

/**
 * Display final database document count
 */
async function displayFinalCount(target: string, couchUrl: string): Promise<void> {
  const finalTargetInfo = await checkDatabaseExists(target, couchUrl);
  console.log(`\nTarget database now has ${chalk.cyan(finalTargetInfo.docCount)} documents`);
}

async function performReplication(config: ReplicationConfig): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  const spinner = ora();

  try {
    logConfiguration(config);

    const sourceValid = await validateSource(config.source!, couchConfig.url, spinner);
    if (!sourceValid) {
      process.exit(1);
    }

    const targetReady = await ensureTargetDatabase(
      config.target!,
      couchConfig.url,
      config.createTarget,
    );
    if (!targetReady) {
      process.exit(1);
    }

    const proceed = await confirmReplication();
    if (!proceed) {
      process.exit(0);
    }

    const { result, duration } = await executeReplication(config, couchConfig.url, spinner);

    displayReplicationResults(result, config, duration);

    if (!config.continuous && result.ok) {
      await displayFinalCount(config.target!, couchConfig.url);
    }
  } catch (error) {
    spinner.fail('Replication failed');
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      displayErrorHelp(error);
    }

    process.exit(1);
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('replicate-interactive')
    .description('Interactive CouchDB replication tool')
    .option('-s, --source <database>', 'source database name')
    .option('-t, --target <database>', 'target database name')
    .option('-c, --continuous', 'enable continuous replication', false)
    .option('--no-create-target', "do not create target database if it doesn't exist")
    .parse(process.argv);

  const options = program.opts<Partial<ReplicationConfig>>();

  try {
    const config = await getReplicationConfig(options);
    await performReplication(config);
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
