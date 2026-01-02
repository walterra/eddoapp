/**
 * Core replication logic shared between replicate.ts and replicate-interactive.ts
 */
import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import chalk from 'chalk';
import nano from 'nano';
import ora, { type Ora } from 'ora';

import { checkDatabaseExists, formatDuration } from './backup-utils.js';

/** Parsed command line arguments for replication */
export interface ReplicateArgs {
  source: string;
  target: string;
  continuous: boolean;
}

/** Result of replication operation */
export interface ReplicationResult {
  ok: boolean;
  duration: number;
  result: nano.DatabaseReplicateResponse;
}

/** Options for performing replication */
interface ReplicationOptions {
  source: string;
  target: string;
  continuous: boolean;
  couchUrl: string;
  spinner: Ora;
}

/**
 * Log history details from replication result
 */
function logHistoryDetails(history: nano.DatabaseReplicationHistoryItem): void {
  console.log(`Documents written: ${chalk.cyan(history.docs_written || 0)}`);
  console.log(`Documents read: ${chalk.cyan(history.docs_read || 0)}`);
  console.log(`Missing documents: ${chalk.cyan(history.missing_checked || 0)}`);
  console.log(`Errors: ${chalk.red(history.doc_write_failures || 0)}`);
}

/**
 * Log continuous replication info
 */
function logContinuousInfo(result: nano.DatabaseReplicateResponse): void {
  console.log(`\n${chalk.yellow('ℹ️  Continuous replication is running in the background')}`);
  console.log(`Replication ID: ${chalk.cyan(result._id || 'N/A')}`);
}

/**
 * Log replication summary
 */
function logReplicationSummary(
  result: nano.DatabaseReplicateResponse,
  continuous: boolean,
  duration: number,
): void {
  console.log();
  console.log(chalk.bold('📊 Replication Summary:'));

  if (!result.ok) {
    console.log(`Status: ${chalk.red('✗ Failed')}`);
    if (result.errors) {
      console.log(`Errors: ${chalk.red(JSON.stringify(result.errors, null, 2))}`);
    }
    return;
  }

  console.log(`Status: ${chalk.green('✓ Success')}`);

  if (result.history && result.history.length > 0) {
    logHistoryDetails(result.history[0]);
  }

  if (continuous) {
    logContinuousInfo(result);
  } else {
    console.log(`Duration: ${chalk.cyan(formatDuration(duration))}`);
  }
}

/**
 * Validate source database exists
 */
async function validateSourceDatabase(
  source: string,
  couchUrl: string,
  spinner: Ora,
): Promise<boolean> {
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
 * Ensure target database exists, create if needed
 */
async function ensureTargetDatabase(
  target: string,
  couchUrl: string,
  spinner: Ora,
): Promise<boolean> {
  spinner.start('Checking target database...');
  const targetInfo = await checkDatabaseExists(target, couchUrl);

  if (!targetInfo.exists) {
    spinner.warn(chalk.yellow(`Target database '${target}' does not exist`));
    spinner.start(`Creating target database '${target}'...`);
    const couch = nano(couchUrl);
    await couch.db.create(target);
    spinner.succeed(`Target database '${target}' created`);
  } else {
    spinner.succeed(`Target database '${target}' found (${targetInfo.docCount} documents)`);
  }

  return true;
}

/**
 * Perform the actual replication
 */
async function performReplication(opts: ReplicationOptions): Promise<ReplicationResult> {
  opts.spinner.start('Starting replication...');
  const startTime = Date.now();

  const couch = nano(opts.couchUrl);
  const result = await couch.db.replicate(opts.source, opts.target, {
    create_target: false,
    continuous: opts.continuous || false,
  });

  const duration = Date.now() - startTime;
  opts.spinner.succeed(`Replication ${opts.continuous ? 'started' : 'completed'} successfully`);

  return { ok: result.ok, duration, result };
}

/**
 * Execute full replication workflow
 */
export async function executeReplication(args: ReplicateArgs): Promise<void> {
  const env = validateEnv(process.env);
  const couchConfig = getCouchDbConfig(env);
  const spinner = ora();

  console.log(chalk.bold('🔄 CouchDB Replication'));
  console.log(`Source: ${chalk.cyan(args.source)}`);
  console.log(`Target: ${chalk.cyan(args.target)}`);
  console.log(`Mode: ${args.continuous ? chalk.yellow('Continuous') : chalk.green('One-time')}`);
  console.log();

  const sourceValid = await validateSourceDatabase(args.source, couchConfig.url, spinner);
  if (!sourceValid) {
    process.exit(1);
  }

  await ensureTargetDatabase(args.target, couchConfig.url, spinner);

  const { result, duration } = await performReplication({
    source: args.source,
    target: args.target,
    continuous: args.continuous,
    couchUrl: couchConfig.url,
    spinner,
  });

  logReplicationSummary(result, args.continuous, duration);

  if (!args.continuous && result.ok) {
    const finalTargetInfo = await checkDatabaseExists(args.target, couchConfig.url);
    console.log(`\nTarget database now has ${chalk.cyan(finalTargetInfo.docCount)} documents`);
  }
}

/**
 * Display helpful error messages based on error type
 */
export function displayReplicationError(error: Error): void {
  if (error.message.includes('ECONNREFUSED')) {
    console.error(chalk.yellow('\nℹ️  Make sure CouchDB is running and accessible'));
  } else if (error.message.includes('unauthorized')) {
    console.error(
      chalk.yellow('\nℹ️  Check your CouchDB credentials in the environment variables'),
    );
  }
}
