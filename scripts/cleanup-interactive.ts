#!/usr/bin/env tsx

import chalk from 'chalk';
import { Command } from 'commander';
import nano from 'nano';
import ora from 'ora';
import prompts from 'prompts';
import { getCouchDbConfig, validateEnv } from '../packages/core-server/src/config/env.js';

interface CleanupConfig {
  mode: 'all' | 'pattern' | 'age' | 'custom';
  pattern?: string;
  age?: number;
  dryRun: boolean;
  force: boolean;
  databases?: string[];
}

interface DatabaseInfo {
  name: string;
  docCount: number;
  diskSize: number;
  isTestDatabase: boolean;
}

async function main() {
  const program = new Command();

  program
    .name('cleanup-interactive')
    .description('Interactive CouchDB test database cleanup tool')
    .option('-m, --mode <mode>', 'cleanup mode: all, pattern, age, custom', 'all')
    .option('-p, --pattern <pattern>', 'database name pattern to match')
    .option('-a, --age <days>', 'delete databases older than N days', parseInt)
    .option('-d, --dry-run', 'show what would be deleted without actually deleting', false)
    .option('-f, --force', 'skip confirmation prompts', false)
    .option('--databases <databases>', 'comma-separated list of specific databases to clean')
    .parse(process.argv);

  const options = program.opts();

  console.log(chalk.blue('\n🧹 CouchDB Test Database Cleanup Tool\n'));

  try {
    // Environment configuration using shared validation
    const env = validateEnv(process.env);
    const couchConfig = getCouchDbConfig(env);

    // Auto-detect mode based on provided options
    let mode: CleanupConfig['mode'] = options.mode as CleanupConfig['mode'];
    if (options.pattern && mode === 'all') {
      mode = 'pattern';
    }
    if (options.databases && mode === 'all') {
      mode = 'custom';
    }

    const config: CleanupConfig = {
      mode,
      pattern: options.pattern,
      age: options.age,
      dryRun: options.dryRun,
      force: options.force,
      databases: options.databases?.split(',').map((db: string) => db.trim()),
    };

    if (!config.force) {
      console.log(
        chalk.yellow(
          '⚠️  This tool will delete databases. Make sure you have backups if needed.\n',
        ),
      );
    }

    await runCleanup(couchConfig, config);
  } catch (error) {
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error(chalk.yellow('\nℹ️  Make sure CouchDB is running and accessible'));
      } else if (error.message.includes('unauthorized')) {
        console.error(
          chalk.yellow('\nℹ️  Check your CouchDB credentials in the environment variables'),
        );
      }
    }

    process.exit(1);
  }
}

async function runCleanup(couchConfig: { url: string; dbName: string }, config: CleanupConfig) {
  const couch = nano(couchConfig.url);

  // Discover available databases
  const spinner = ora('Discovering databases...').start();
  const allDatabases = await getAvailableDatabases(couchConfig.url);
  spinner.succeed(`Found ${allDatabases.length} databases`);

  // Get database info for all databases
  const databaseInfos = await getDatabaseInfos(couchConfig.url, allDatabases);

  // Filter databases based on cleanup config
  const targetDatabases = await filterDatabases(databaseInfos, config);

  if (targetDatabases.length === 0) {
    console.log(chalk.green('\n✅ No databases match the cleanup criteria'));
    return;
  }

  // Show what will be cleaned up
  console.log(
    chalk.cyan(`\n📋 Databases to ${config.dryRun ? 'be cleaned (dry-run)' : 'clean up'}:`),
  );
  targetDatabases.forEach((db, index) => {
    const sizeStr = (db.diskSize / 1024 / 1024).toFixed(2);
    console.log(`  ${index + 1}. ${db.name} (${db.docCount} docs, ${sizeStr} MB)`);
  });

  if (config.dryRun) {
    console.log(chalk.green('\n✅ Dry-run complete. No databases were deleted.'));
    return;
  }

  // Confirm deletion
  if (!config.force) {
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: `Delete ${targetDatabases.length} database(s)?`,
      initial: false,
    });

    if (!proceed) {
      console.log(chalk.red('\n✗ Cleanup cancelled'));
      return;
    }
  }

  // Perform cleanup
  await performCleanup(couch, targetDatabases);
}

async function getAvailableDatabases(couchdbUrl: string): Promise<string[]> {
  const url = new URL(couchdbUrl);
  const baseUrl = `${url.protocol}//${url.host}`;
  const credentials =
    url.username && url.password
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (credentials) {
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(`${baseUrl}/_all_dbs`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch databases: ${response.status} ${response.statusText}`);
  }

  const databases: string[] = await response.json();

  // Filter out system databases (those starting with _)
  return databases.filter((db) => !db.startsWith('_'));
}

async function getDatabaseInfos(couchdbUrl: string, databases: string[]): Promise<DatabaseInfo[]> {
  const url = new URL(couchdbUrl);
  const baseUrl = `${url.protocol}//${url.host}`;
  const credentials =
    url.username && url.password
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (credentials) {
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const databaseInfos: DatabaseInfo[] = [];

  for (const dbName of databases) {
    try {
      const response = await fetch(`${baseUrl}/${dbName}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const dbInfo = await response.json();
        databaseInfos.push({
          name: dbName,
          docCount: dbInfo.doc_count || 0,
          diskSize: dbInfo.disk_size || 0,
          isTestDatabase: isTestDatabase(dbName),
        });
      }
    } catch (error) {
      // Skip databases we can't access
      console.warn(
        chalk.yellow(
          `⚠️  Could not access database '${dbName}': ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return databaseInfos;
}

function isTestDatabase(dbName: string): boolean {
  const testPatterns = [/^eddo_test_/, /^test-/, /^todos-test/, /^test_/];

  return testPatterns.some((pattern) => pattern.test(dbName));
}

async function filterDatabases(
  databaseInfos: DatabaseInfo[],
  config: CleanupConfig,
): Promise<DatabaseInfo[]> {
  let filtered = databaseInfos;

  if (config.mode === 'all') {
    // Only include test databases
    filtered = filtered.filter((db) => db.isTestDatabase);
  } else if (config.mode === 'pattern' && config.pattern) {
    // Convert glob pattern to regex
    const regexPattern = config.pattern
      .replace(/\*/g, '.*') // * becomes .*
      .replace(/\?/g, '.') // ? becomes .
      .replace(/\./g, '\\.') // Escape literal dots
      .replace(/\\\.\*/g, '.*'); // Restore .* for our * conversion

    const regex = new RegExp(`^${regexPattern}$`);
    filtered = filtered.filter((db) => regex.test(db.name));
  } else if (config.mode === 'custom' && config.databases) {
    filtered = filtered.filter((db) => config.databases!.includes(db.name));
  }

  // If not in interactive mode, let user refine selection
  if (!config.force && filtered.length > 0) {
    const choices = filtered.map((db) => ({
      title: `${db.name} (${db.docCount} docs)`,
      value: db.name,
      selected: true,
    }));

    const { selectedDatabases } = await prompts({
      type: 'multiselect',
      name: 'selectedDatabases',
      message: 'Select databases to clean up:',
      choices,
      min: 0,
    });

    if (!selectedDatabases || selectedDatabases.length === 0) {
      return [];
    }

    filtered = filtered.filter((db) => selectedDatabases.includes(db.name));
  }

  return filtered;
}

async function performCleanup(couch: nano.ServerScope, databases: DatabaseInfo[]): Promise<void> {
  const spinner = ora('Cleaning up databases...').start();

  let deletedCount = 0;
  let failedCount = 0;

  for (const db of databases) {
    try {
      await couch.db.destroy(db.name);
      deletedCount++;
      spinner.text = `Deleted ${deletedCount}/${databases.length} databases...`;
    } catch (error) {
      failedCount++;
      console.warn(
        chalk.yellow(
          `⚠️  Failed to delete '${db.name}': ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  spinner.succeed(`Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`);

  if (deletedCount > 0) {
    console.log(chalk.green(`\n✅ Successfully deleted ${deletedCount} database(s)`));
  }

  if (failedCount > 0) {
    console.log(chalk.yellow(`\n⚠️  Failed to delete ${failedCount} database(s)`));
  }
}

// Handle user cancellation gracefully
process.on('SIGINT', () => {
  console.log(chalk.red('\n\n✗ Cleanup cancelled by user'));
  process.exit(0);
});

// ES module entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
