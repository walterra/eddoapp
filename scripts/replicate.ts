#!/usr/bin/env tsx

/**
 * CouchDB replication script using nano
 * Replicates data from source to target database (one-way sync)
 */

import nano from 'nano';
import ora from 'ora';
import chalk from 'chalk';
import { validateEnv, getCouchDbConfig } from '@eddo/core-server/config';
import { checkDatabaseExists, formatDuration } from './backup-utils.js';

// Environment configuration using shared validation
const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

// Parse command line arguments
function parseArgs(): { source: string; target: string; continuous?: boolean } {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${chalk.bold('CouchDB Replication Script')}

Usage: pnpm replicate <source-db> <target-db> [options]

Options:
  --continuous  Enable continuous replication
  --help, -h    Show this help message

Examples:
  pnpm replicate production-db staging-db
  pnpm replicate user-db-1 consolidated-db
  pnpm replicate source target --continuous
`);
    process.exit(0);
  }

  const source = args[0];
  const target = args[1];
  const continuous = args.includes('--continuous');

  if (!source || !target) {
    console.error(chalk.red('Error: Both source and target database names are required'));
    console.error('Usage: pnpm replicate <source-db> <target-db>');
    process.exit(1);
  }

  return { source, target, continuous };
}

async function replicate(): Promise<void> {
  const { source, target, continuous } = parseArgs();
  const spinner = ora();

  try {
    console.log(chalk.bold('🔄 CouchDB Replication'));
    console.log(`Source: ${chalk.cyan(source)}`);
    console.log(`Target: ${chalk.cyan(target)}`);
    console.log(`Mode: ${continuous ? chalk.yellow('Continuous') : chalk.green('One-time')}`);
    console.log();

    // Check if source database exists
    spinner.start('Checking source database...');
    const sourceInfo = await checkDatabaseExists(source, couchConfig.url);
    
    if (!sourceInfo.exists) {
      spinner.fail(chalk.red(`Source database '${source}' does not exist`));
      process.exit(1);
    }
    
    spinner.succeed(`Source database '${source}' found (${sourceInfo.docCount} documents)`);

    // Check if target database exists
    spinner.start('Checking target database...');
    const targetInfo = await checkDatabaseExists(target, couchConfig.url);
    
    if (!targetInfo.exists) {
      spinner.warn(chalk.yellow(`Target database '${target}' does not exist`));
      
      // Create target database
      spinner.start(`Creating target database '${target}'...`);
      const couch = nano(couchConfig.url);
      await couch.db.create(target);
      spinner.succeed(`Target database '${target}' created`);
    } else {
      spinner.succeed(`Target database '${target}' found (${targetInfo.docCount} documents)`);
    }

    // Start replication
    spinner.start('Starting replication...');
    const startTime = Date.now();
    
    const couch = nano(couchConfig.url);
    
    // Create replication options
    const replicationOpts: nano.DatabaseReplicateOptions = {
      create_target: false, // We already handle this above
      continuous: continuous || false,
    };

    // Perform replication
    const result = await couch.db.replicate(source, target, replicationOpts);
    
    const duration = Date.now() - startTime;
    spinner.succeed(`Replication ${continuous ? 'started' : 'completed'} successfully`);

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
      
      if (continuous) {
        console.log(`\n${chalk.yellow('ℹ️  Continuous replication is running in the background')}`);
        console.log(`Replication ID: ${chalk.cyan(result._id || 'N/A')}`);
      } else {
        console.log(`Duration: ${chalk.cyan(formatDuration(duration))}`);
        
        // Check final document count
        const finalTargetInfo = await checkDatabaseExists(target, couchConfig.url);
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

// Run replication if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  replicate().catch(console.error);
}

export { replicate };