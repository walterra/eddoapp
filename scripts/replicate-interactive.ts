#!/usr/bin/env tsx

/**
 * Interactive CouchDB replication script with CLI interface
 * Supports both interactive prompts and direct command-line arguments
 */

import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import nano from 'nano';
import { validateEnv, getCouchDbConfig, getAvailableDatabases } from '@eddo/core-server/config';
import { checkDatabaseExists, formatDuration } from './backup-utils.js';

interface ReplicationConfig {
  source?: string;
  target?: string;
  continuous: boolean;
  createTarget: boolean;
}

async function getReplicationConfig(options: Partial<ReplicationConfig>): Promise<ReplicationConfig> {
  // Environment configuration
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  
  // Default values
  const defaults: ReplicationConfig = {
    continuous: false,
    createTarget: true,
  };

  // If all required options are provided, return them
  if (options.source && options.target) {
    return { ...defaults, ...options };
  }

  // Otherwise, prompt for missing values
  console.log(chalk.blue('\n🔄 CouchDB Interactive Replication\n'));
  
  // Discover available databases
  const spinner = ora('Discovering available databases...').start();
  const availableDatabases = await getAvailableDatabases(env);
  spinner.stop();

  const questions: prompts.PromptObject[] = [];
  
  // Source database selection
  if (!options.source) {
    if (availableDatabases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
      console.log(chalk.gray('Falling back to manual input...'));
      
      questions.push({
        type: 'text',
        name: 'source',
        message: 'Source database name:',
        validate: (value: string) => value.length > 0 || 'Database name is required',
      });
    } else {
      console.log(chalk.green(`✅ Found ${availableDatabases.length} database(s)\n`));
      
      const sourceChoices = [
        ...availableDatabases.map(db => ({
          title: db,
          value: db,
        })),
        {
          title: '📝 Enter custom database name',
          value: '__custom__',
          description: 'Manually type a database name',
        },
      ];

      questions.push({
        type: 'select',
        name: 'source',
        message: 'Select source database:',
        choices: sourceChoices,
      });

      // If user selects custom, ask for manual input
      questions.push({
        type: (prev) => prev === '__custom__' ? 'text' : null,
        name: 'source',
        message: 'Enter source database name:',
        validate: (value: string) => value.length > 0 || 'Database name is required',
      });
    }
  }

  // Target database selection
  if (!options.target) {
    const targetChoices = availableDatabases.length > 0 ? [
      ...availableDatabases.map(db => ({
        title: db,
        value: db,
      })),
      {
        title: '📝 Enter custom database name',
        value: '__custom__',
        description: 'Create new or use existing database',
      },
    ] : [];

    if (targetChoices.length > 0) {
      questions.push({
        type: 'select',
        name: 'target',
        message: 'Select target database:',
        choices: targetChoices,
      });
    } else {
      questions.push({
        type: 'text',
        name: 'target',
        message: 'Target database name:',
        validate: (value: string) => value.length > 0 || 'Database name is required',
      });
    }

    // If user selects custom, ask for manual input
    questions.push({
      type: (prev) => prev === '__custom__' ? 'text' : null,
      name: 'target',
      message: 'Enter target database name:',
      validate: (value: string) => value.length > 0 || 'Database name is required',
    });
  }

  // Additional options
  questions.push({
    type: 'confirm',
    name: 'continuous',
    message: 'Enable continuous replication?',
    initial: defaults.continuous,
  });

  const answers = await prompts(questions);
  
  // User cancelled
  if (!answers.source || !answers.target) {
    console.log(chalk.red('\n✗ Replication cancelled'));
    process.exit(0);
  }

  return { ...defaults, ...answers };
}

async function performReplication(config: ReplicationConfig): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  const spinner = ora();

  try {
    console.log(chalk.bold('\n📋 Replication Configuration:'));
    console.log(`Source: ${chalk.cyan(config.source)}`);
    console.log(`Target: ${chalk.cyan(config.target)}`);
    console.log(`Mode: ${config.continuous ? chalk.yellow('Continuous') : chalk.green('One-time')}`);
    console.log();

    // Check if source database exists
    spinner.start('Checking source database...');
    const sourceInfo = await checkDatabaseExists(config.source!, couchConfig.url);
    
    if (!sourceInfo.exists) {
      spinner.fail(chalk.red(`Source database '${config.source}' does not exist`));
      process.exit(1);
    }
    
    spinner.succeed(`Source database '${config.source}' found (${sourceInfo.docCount} documents)`);

    // Check if target database exists
    spinner.start('Checking target database...');
    const targetInfo = await checkDatabaseExists(config.target!, couchConfig.url);
    
    if (!targetInfo.exists) {
      if (config.createTarget) {
        spinner.warn(chalk.yellow(`Target database '${config.target}' does not exist`));
        
        // Create target database
        spinner.start(`Creating target database '${config.target}'...`);
        const couch = nano(couchConfig.url);
        await couch.db.create(config.target!);
        spinner.succeed(`Target database '${config.target}' created`);
      } else {
        spinner.fail(chalk.red(`Target database '${config.target}' does not exist`));
        process.exit(1);
      }
    } else {
      spinner.succeed(`Target database '${config.target}' found (${targetInfo.docCount} documents)`);
      
      // Warn about existing data
      if (targetInfo.docCount > 0) {
        console.log(chalk.yellow(`\n⚠️  Target database contains ${targetInfo.docCount} existing documents`));
        console.log(chalk.gray('These will be preserved and updated/merged with source data\n'));
      }
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
    
    // Create replication options
    const replicationOpts: nano.DatabaseReplicateOptions = {
      create_target: false, // We handle this above
      continuous: config.continuous,
    };

    // Perform replication
    const result = await couch.db.replicate(config.source!, config.target!, replicationOpts);
    
    const duration = Date.now() - startTime;
    spinner.succeed(`Replication ${config.continuous ? 'started' : 'completed'} successfully`);

    // Display results
    console.log();
    console.log(chalk.bold('📊 Replication Summary:'));
    
    if (result.ok) {
      console.log(`Status: ${chalk.green('✓ Success')}`);
      
      if (result.history && result.history.length > 0) {
        const history = result.history[0];
        console.log(`Documents written: ${chalk.cyan(history.docs_written || 0)}`);
        console.log(`Documents read: ${chalk.cyan(history.docs_read || 0)}`);
        console.log(`Missing documents: ${chalk.cyan(history.missing_checked || 0)}`);
        console.log(`Errors: ${chalk.red(history.doc_write_failures || 0)}`);
      }
      
      if (config.continuous) {
        console.log(`\n${chalk.yellow('ℹ️  Continuous replication is running in the background')}`);
        console.log(`Replication ID: ${chalk.cyan(result._id || 'N/A')}`);
      } else {
        console.log(`Duration: ${chalk.cyan(formatDuration(duration))}`);
        
        // Check final document count
        const finalTargetInfo = await checkDatabaseExists(config.target!, couchConfig.url);
        console.log(`\nTarget database now has ${chalk.cyan(finalTargetInfo.docCount)} documents`);
      }
    } else {
      console.log(`Status: ${chalk.red('✗ Failed')}`);
      if (result.errors) {
        console.log(`Errors: ${chalk.red(JSON.stringify(result.errors, null, 2))}`);
      }
    }

  } catch (error) {
    spinner.fail('Replication failed');
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error(chalk.yellow('\nℹ️  Make sure CouchDB is running and accessible'));
      } else if (error.message.includes('unauthorized')) {
        console.error(chalk.yellow('\nℹ️  Check your CouchDB credentials in the environment variables'));
      }
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
    .option('--no-create-target', 'do not create target database if it doesn\'t exist')
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };