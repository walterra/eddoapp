#!/usr/bin/env tsx

/**
 * CouchDB replication script using nano
 * Replicates data from source to target database (one-way sync)
 */

import chalk from 'chalk';
import {
  displayReplicationError,
  executeReplication,
  type ReplicateArgs,
} from './replicate-core.js';

/**
 * Parse command line arguments
 */
function parseArgs(): ReplicateArgs {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
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

function printHelp(): void {
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
}

async function replicate(): Promise<void> {
  const args = parseArgs();

  try {
    await executeReplication(args);
  } catch (error) {
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      displayReplicationError(error);
    }

    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  replicate().catch(console.error);
}

export { replicate };
