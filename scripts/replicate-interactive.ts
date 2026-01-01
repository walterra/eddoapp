#!/usr/bin/env tsx

/**
 * Interactive CouchDB replication script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import { Command } from 'commander';
import nano from 'nano';
import ora from 'ora';
import prompts from 'prompts';

import { checkDatabaseExists } from './backup-utils.js';
import {
  displayErrorHelp,
  displayReplicationResults,
  ensureTargetDatabase,
  getReplicationConfig,
  type ReplicationConfig,
} from './replicate-helpers.js';

async function performReplication(config: ReplicationConfig): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  const spinner = ora();

  try {
    console.log(chalk.bold('\n📋 Replication Configuration:'));
    console.log(`Source: ${chalk.cyan(config.source)}`);
    console.log(`Target: ${chalk.cyan(config.target)}`);
    console.log(
      `Mode: ${config.continuous ? chalk.yellow('Continuous') : chalk.green('One-time')}`,
    );
    console.log();

    // Check if source database exists
    spinner.start('Checking source database...');
    const sourceInfo = await checkDatabaseExists(config.source!, couchConfig.url);

    if (!sourceInfo.exists) {
      spinner.fail(chalk.red(`Source database '${config.source}' does not exist`));
      process.exit(1);
    }

    spinner.succeed(`Source database '${config.source}' found (${sourceInfo.docCount} documents)`);

    // Ensure target database exists
    const targetReady = await ensureTargetDatabase(
      config.target!,
      couchConfig.url,
      config.createTarget,
    );

    if (!targetReady) {
      process.exit(1);
    }

    // Confirm before proceeding
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with replication?',
      initial: true,
    });

    if (!proceed) {
      console.log(chalk.red('\n✗ Replication cancelled'));
      process.exit(0);
    }

    // Start replication
    spinner.start('Starting replication...');
    const startTime = Date.now();

    const couch = nano(couchConfig.url);
    const result = await couch.db.replicate(config.source!, config.target!, {
      create_target: false,
      continuous: config.continuous,
    });

    const duration = Date.now() - startTime;
    spinner.succeed(`Replication ${config.continuous ? 'started' : 'completed'} successfully`);

    displayReplicationResults(result, config, duration);

    // Display final document count for non-continuous
    if (!config.continuous && result.ok) {
      const finalTargetInfo = await checkDatabaseExists(config.target!, couchConfig.url);
      console.log(`\nTarget database now has ${chalk.cyan(finalTargetInfo.docCount)} documents`);
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
